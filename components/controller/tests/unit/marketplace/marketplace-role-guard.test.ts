/**
 * Unit-тесты MarketplaceRoleGuard (Story 1.6).
 *
 * Покрывают AC:
 *   (a) роль присутствует → guard true;
 *   (b) роль отсутствует → ForbiddenException с сообщением AC
 *       "Forbidden: marketplace role 'admin' required, member has [...]"
 *       + warn-лог "forbidden-attempt: ...";
 *   (c) декоратор не задан (нет @RequireMarketplaceRole) → guard true;
 *   (d) server-secret bypass → true даже при отсутствии currentMember;
 *   (e) нет currentMember при заданном декораторе → Forbidden (рассогласование
 *       UseGuards).
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { server_secret: 'svc-secret' },
}));

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MARKETPLACE_ROLES_METADATA_KEY } from '~/extensions/marketplace/application/decorators/marketplace-role.decorator';
import { MarketplaceRoleGuard } from '~/extensions/marketplace/application/guards/marketplace-role.guard';
import { configureExtensionAuth } from '@coopenomics/extension-kit';

// Секрет межсервисного обхода живёт в каркасе: guard'ы спрашивают его там,
// а не в конфиге ядра. Хост обязан задать его на старте — тест тоже хост.
configureExtensionAuth({ serverSecret: 'svc-secret' });


const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

function makeCtx({ req, requiredRoles }: { req: any; requiredRoles?: string[] }) {
  const handlerName = 'someHandler';
  const className = 'SomeResolver';
  const gqlCtx = { req, currentMember: req?.currentMember };
  return {
    getType: () => 'graphql',
    getHandler: () => ({ name: handlerName }) as any,
    getClass: () => ({ name: className }) as any,
    getArgs: () => [undefined, undefined, gqlCtx, undefined] as any,
    getArgByIndex: (i: number) => [undefined, undefined, gqlCtx, undefined][i],
    switchToHttp: () => ({ getRequest: () => req }) as any,
    switchToRpc: () => undefined as any,
    switchToWs: () => undefined as any,
    _gqlCtx: gqlCtx,
    _requiredRoles: requiredRoles,
  };
}

function makeReflector(requiredRoles?: string[]): Reflector {
  return {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => {
      // Story 1.6 fixture: возвращает requiredRoles только для marketplace_roles
      // декоратора. Декоратор marketplace_access (Story 1.8) не задан в этих
      // кейсах — отдаём undefined, чтобы Guard не пытался канонически
      // парсить «requiredRoles» как `{resource, action}`.
      if (key === 'marketplace_roles') return requiredRoles;
      return undefined;
    }),
  } as any;
}

describe('MarketplaceRoleGuard', () => {
  it('декоратор @RequireMarketplaceRole не задан → guard true', () => {
    const guard = new MarketplaceRoleGuard(makeReflector(undefined), makeLogger());
    const ctx = makeCtx({ req: { headers: {} } });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('decoratoр пустой массив → guard true', () => {
    const guard = new MarketplaceRoleGuard(makeReflector([]), makeLogger());
    const ctx = makeCtx({ req: { headers: {} } });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('requested role в marketplace_roles → guard true', () => {
    const guard = new MarketplaceRoleGuard(makeReflector(['admin']), makeLogger());
    const req = {
      headers: {},
      user: { username: 'chair', role: 'chairman', status: 'active' },
      currentMember: {
        username: 'chair',
        core_roles: ['User', 'Member', 'Chairman'],
        marketplace_roles: ['orderer', 'board_readonly', 'admin', 'board'],
      },
    };
    const ctx = makeCtx({ req, requiredRoles: ['admin'] });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('OR-семантика: одна из ролей хватает → true', () => {
    const guard = new MarketplaceRoleGuard(makeReflector(['admin', 'board_readonly']), makeLogger());
    const req = {
      headers: {},
      currentMember: {
        username: 'm',
        core_roles: ['User', 'Member'],
        marketplace_roles: ['orderer', 'board_readonly'],
      },
    };
    const ctx = makeCtx({ req });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('роль отсутствует → ForbiddenException + warn-лог forbidden-attempt', () => {
    const logger = makeLogger();
    const guard = new MarketplaceRoleGuard(makeReflector(['admin']), logger);
    const req = {
      headers: {},
      currentMember: {
        username: 'alice',
        core_roles: ['User'],
        marketplace_roles: ['orderer'],
      },
    };
    const ctx = makeCtx({ req });

    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx as any);
    } catch (e: any) {
      expect(e.message).toContain("Forbidden: marketplace role 'admin' required");
      expect(e.message).toContain('member has [orderer]');
    }

    expect(logger.warn).toHaveBeenCalled();
    const message = (logger.warn as jest.Mock).mock.calls[0][0] as string;
    expect(message).toContain('forbidden-attempt');
    expect(message).toContain('member=alice');
    expect(message).toContain('requested_role=[admin]');
    expect(message).toContain('actual_marketplace_roles=[orderer]');
    expect(message).toContain('actual_core_roles=[User]');
  });

  it('server-secret → true даже без currentMember', () => {
    const guard = new MarketplaceRoleGuard(makeReflector(['admin']), makeLogger());
    const ctx = makeCtx({ req: { headers: { 'server-secret': 'svc-secret' } } });
    expect(guard.canActivate(ctx as any)).toBe(true);
  });

  it('нет currentMember + декоратор задан → ForbiddenException (рассогласование UseGuards)', () => {
    const guard = new MarketplaceRoleGuard(makeReflector(['admin']), makeLogger());
    const ctx = makeCtx({ req: { headers: {} } });
    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
  });

  it('Decorator-helper RequireMarketplaceRole пишет метаданные', () => {
    const target = {};
    const descriptor = { value: () => undefined };
    const required = ['admin', 'board'] as const;
    const factory = require('~/extensions/marketplace/application/decorators/marketplace-role.decorator')
      .RequireMarketplaceRole;
    const decorate = factory(...required);
    decorate(target, 'someHandler', descriptor);
    expect(Reflect.getMetadata(MARKETPLACE_ROLES_METADATA_KEY, descriptor.value)).toEqual([
      'admin',
      'board',
    ]);
  });
});
