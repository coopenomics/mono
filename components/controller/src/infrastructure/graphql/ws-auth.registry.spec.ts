/**
 * Опознание ws-соединения — тем же путём, что HTTP-запрос.
 *
 * Инварианты:
 *   - пайщика опознаёт зарегистрированный владелец (JwtAuthStrategy.validate),
 *     и в контекст подписки ложится ровно его результат — та же учётная запись,
 *     что у HTTP-запроса; вместе с ней токен заголовком, чтобы гарды на
 *     подписке работали как на запросе;
 *   - отказ опознания (сессия завершена), чужой тип токена, негодная подпись,
 *     отсутствие токена или незарегистрированный владелец — соединение
 *     отклоняется, пустой пользователь в контекст не попадает.
 *
 * До 23.09.2026 в контекст клался только `{ sub }`, и подписка, написанная как
 * обычный резолвер (`@CurrentUser().username`), отклонялась на каждом соединении.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { ...jest.requireActual('~/config/config').default, jwt: { secret: 'ws-auth-test-secret' } },
}));
jest.mock('~/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as jwt from 'jsonwebtoken';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@coopenomics/extension-kit';
import { tokenTypes } from '~/types/token.types';

const SUB = '11111111-1111-4111-8111-111111111111';
const USER = { id: SUB, username: 'ant', role: 'chairman', status: 'active', session_id: 'sess-1' };

const sign = (payload: Record<string, unknown>, secret = 'ws-auth-test-secret') =>
  jwt.sign(payload, secret, { expiresIn: 300 });

/** Реестр — модульное состояние: каждый тест берёт свежий экземпляр модуля. */
function load() {
  let mod!: typeof import('./ws-auth.registry');
  jest.isolateModules(() => {
    mod = require('./ws-auth.registry');
  });
  return mod;
}

describe('ws-auth.registry', () => {
  it('годный access-токен: в контексте подписки та же учётная запись, что вернул validate, и токен заголовком', async () => {
    const mod = load();
    const resolver = jest.fn().mockResolvedValue(USER);
    mod.registerWsUserResolver(resolver);
    const token = sign({ sub: SUB, type: tokenTypes.ACCESS, sid: 'sess-1' });
    const context: any = { connectionParams: { authorization: `Bearer ${token}` } };

    await expect(mod.authenticateWsConnection(context)).resolves.toBe(true);

    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ sub: SUB, type: tokenTypes.ACCESS, sid: 'sess-1' }));
    const { req } = mod.buildWsContext(context);
    expect(req.user).toBe(USER);
    expect(req.headers).toEqual({ authorization: `Bearer ${token}` });
  });

  it('токен без префикса Bearer тоже принимается', async () => {
    const mod = load();
    mod.registerWsUserResolver(jest.fn().mockResolvedValue(USER));
    const token = sign({ sub: SUB, type: tokenTypes.ACCESS });
    const context: any = { connectionParams: { Authorization: token } };

    await expect(mod.authenticateWsConnection(context)).resolves.toBe(true);
    expect(mod.buildWsContext(context).req.user).toBe(USER);
  });

  it('опознание отказало (сессия завершена) — соединение отклонено, пользователя в контексте нет', async () => {
    const mod = load();
    mod.registerWsUserResolver(jest.fn().mockRejectedValue(new Error('Сессия завершена, требуется повторная авторизация')));
    const context: any = { connectionParams: { authorization: `Bearer ${sign({ sub: SUB, type: tokenTypes.ACCESS })}` } };

    await expect(mod.authenticateWsConnection(context)).resolves.toBe(false);
    expect(mod.buildWsContext(context).req).toEqual({ user: null, headers: {} });
  });

  it('refresh-токен — отказ, до опознания дело не доходит', async () => {
    const mod = load();
    const resolver = jest.fn().mockResolvedValue(USER);
    mod.registerWsUserResolver(resolver);
    const context: any = { connectionParams: { authorization: `Bearer ${sign({ sub: SUB, type: tokenTypes.REFRESH })}` } };

    await expect(mod.authenticateWsConnection(context)).resolves.toBe(false);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('чужая подпись — отказ', async () => {
    const mod = load();
    const resolver = jest.fn().mockResolvedValue(USER);
    mod.registerWsUserResolver(resolver);
    const context: any = {
      connectionParams: { authorization: `Bearer ${sign({ sub: SUB, type: tokenTypes.ACCESS }, 'other-secret')}` },
    };

    await expect(mod.authenticateWsConnection(context)).resolves.toBe(false);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('токена нет — отказ', async () => {
    const mod = load();
    mod.registerWsUserResolver(jest.fn().mockResolvedValue(USER));

    await expect(mod.authenticateWsConnection({ connectionParams: {} })).resolves.toBe(false);
  });

  it('опознание ещё не зарегистрировано — отказ, а не пропуск всех', async () => {
    const mod = load();
    const context: any = { connectionParams: { authorization: `Bearer ${sign({ sub: SUB, type: tokenTypes.ACCESS })}` } };

    await expect(mod.authenticateWsConnection(context)).resolves.toBe(false);
  });

  describe('гарды на подписке судят как на запросе', () => {
    /** Контекст исполнения GraphQL-операции: [root, args, context, info]. */
    function executionContext(gqlContext: unknown, roles: string[]) {
      const handler = () => undefined;
      Reflect.defineMetadata('roles', roles, handler);
      const args = [null, {}, gqlContext, {}];
      return {
        getArgs: () => args,
        getArgByIndex: (i: number) => args[i],
        getType: () => 'graphql',
        getHandler: () => handler,
        getClass: () => Object,
        switchToHttp: () => ({}),
        switchToRpc: () => ({}),
        switchToWs: () => ({}),
      } as any;
    }

    async function connectedAs(user: Record<string, unknown>) {
      const mod = load();
      mod.registerWsUserResolver(jest.fn().mockResolvedValue(user));
      const context: any = { connectionParams: { authorization: `Bearer ${sign({ sub: SUB, type: tokenTypes.ACCESS })}` } };
      await mod.authenticateWsConnection(context);
      return mod.buildWsContext(context);
    }

    it('председатель проходит RolesGuard подписки председателя', async () => {
      const guard = new RolesGuard(new Reflector());
      const ctx = await connectedAs(USER);

      expect(guard.canActivate(executionContext(ctx, ['chairman']))).toBe(true);
    });

    it('пайщик без роли — RolesGuard подписки отказывает', async () => {
      const guard = new RolesGuard(new Reflector());
      const ctx = await connectedAs({ ...USER, role: 'user' });

      expect(() => guard.canActivate(executionContext(ctx, ['chairman']))).toThrow();
    });
  });
});
