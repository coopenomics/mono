/**
 * Ограничитель частоты для GraphQL: до 17.09.2026 полсотни `@Throttle` были
 * украшением — штатный guard берёт запрос через `switchToHttp()`, а в GraphQL
 * там лежит корневой объект резолвера, и сам guard нигде не стоял.
 *
 * Проверяется то, что легко сломать: операция без объявленного лимита не
 * считается вовсе (иначе общий предел контура накрыл бы весь кабинет), а счёт
 * идёт по пайщику из проверенного токена — за одним адресом сидит целый
 * кооперативный участок.
 */
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Throttle } from '@nestjs/throttler';
import type { ThrottlerStorage } from '@nestjs/throttler';
import jwt from 'jsonwebtoken';
import config from '~/config/config';
import { GqlThrottlerGuard } from '~/infrastructure/graphql/gql-throttler.guard';
import { tokenTypes } from '~/types/token.types';

class Resolver {
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  limited(): void {
    return undefined;
  }

  unlimited(): void {
    return undefined;
  }
}

function gqlContext(handler: (...args: any[]) => unknown, req: Record<string, any>, operation = 'mutation'): ExecutionContext {
  const args = [undefined, {}, { req, res: { header: () => undefined } }, { operation: { operation } }];
  return {
    getType: () => 'graphql',
    getHandler: () => handler,
    getClass: () => Resolver,
    getArgs: () => args,
    getArgByIndex: (i: number) => args[i],
    switchToHttp: () => ({ getRequest: () => undefined, getResponse: () => undefined }),
  } as unknown as ExecutionContext;
}

async function buildGuard(increment: jest.Mock) {
  const storage = { increment } as unknown as ThrottlerStorage;
  const guard = new GqlThrottlerGuard([{ ttl: 60000, limit: 50 }] as any, storage, new Reflector());
  await guard.onModuleInit();
  return guard;
}

const record = (totalHits: number, isBlocked = false) => ({
  totalHits,
  timeToExpire: 60,
  isBlocked,
  timeToBlockExpire: isBlocked ? 60 : 0,
});

function accessToken(sub: string): string {
  return jwt.sign({ sub, type: tokenTypes.ACCESS }, config.jwt.secret);
}

describe('GqlThrottlerGuard', () => {
  const env = config.env;

  beforeAll(() => {
    // Ограничитель намеренно выключен в dev-контуре; тест проверяет рабочее поведение.
    (config as { env: string }).env = 'production';
  });

  afterAll(() => {
    (config as { env: string }).env = env;
  });

  it('операция без объявленного лимита не считается', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const guard = await buildGuard(increment);
    await expect(guard.canActivate(gqlContext(Resolver.prototype.unlimited, { ip: '1.2.3.4', headers: {} }))).resolves.toBe(true);
    expect(increment).not.toHaveBeenCalled();
  });

  it('операция с @Throttle считается по пайщику из проверенного токена', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const guard = await buildGuard(increment);
    const req = { ip: '1.2.3.4', headers: { authorization: `Bearer ${accessToken('bob-id')}` } };
    await expect(guard.canActivate(gqlContext(Resolver.prototype.limited, req))).resolves.toBe(true);
    expect(increment).toHaveBeenCalledTimes(1);
    // Лимит и окно берутся из @Throttle, а не из общего предела контура (50/мин).
    expect(increment).toHaveBeenCalledWith(expect.any(String), 60000, 3, 60000, 'default');
  });

  it('два пайщика с одного адреса считаются раздельно', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const guard = await buildGuard(increment);
    const req = (sub: string) => ({ ip: '1.2.3.4', headers: { authorization: `Bearer ${accessToken(sub)}` } });
    await guard.canActivate(gqlContext(Resolver.prototype.limited, req('bob-id')));
    await guard.canActivate(gqlContext(Resolver.prototype.limited, req('alice-id')));
    const [first, second] = increment.mock.calls.map((call) => call[0]);
    expect(first).not.toEqual(second);
  });

  it('поддельный и истёкший токен не дают своего счётчика — счёт по адресу', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const guard = await buildGuard(increment);
    const forged = jwt.sign({ sub: 'mallory-id', type: tokenTypes.ACCESS }, 'not-the-secret');
    await guard.canActivate(gqlContext(Resolver.prototype.limited, { ip: '9.9.9.9', headers: { authorization: `Bearer ${forged}` } }));
    await guard.canActivate(gqlContext(Resolver.prototype.limited, { ip: '9.9.9.9', headers: {} }));
    const [first, second] = increment.mock.calls.map((call) => call[0]);
    expect(first).toEqual(second);
  });

  it('превышение — отказ 429 с русским сообщением', async () => {
    const increment = jest.fn().mockResolvedValue(record(4, true));
    const guard = await buildGuard(increment);
    const req = { ip: '1.2.3.4', headers: {} };
    await expect(guard.canActivate(gqlContext(Resolver.prototype.limited, req))).rejects.toMatchObject({
      status: 429,
      message: expect.stringContaining('Слишком часто'),
    });
  });

  it('подписка не считается: у соединения нет ни адреса, ни ответа', async () => {
    const increment = jest.fn().mockResolvedValue(record(1));
    const guard = await buildGuard(increment);
    const ctx = gqlContext(Resolver.prototype.limited, { headers: {} }, 'subscription');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(increment).not.toHaveBeenCalled();
  });
});
