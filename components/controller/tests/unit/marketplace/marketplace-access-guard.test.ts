/**
 * Unit-тесты MarketplaceRoleGuard под новый декоратор
 * `@RequireMarketplaceAccess(resource, action)` (Story 1.8).
 *
 * Покрывают:
 *   (a) только @RequireMarketplaceAccess → guard вызывает canAccess;
 *   (b) комбинация role + access → guard требует выполнения обоих;
 *   (c) ни декоратора → guard разрешает;
 *   (d) server-secret bypass;
 *   (e) forbidden-attempt лог при отказе по access.
 *
 * Тесты только Role-семантики покрыты в marketplace-role-guard.test.ts.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { server_secret: 'svc-secret' },
}));

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MARKETPLACE_ACCESS_METADATA_KEY } from '~/extensions/marketplace/application/decorators/marketplace-access.decorator';
import { MARKETPLACE_ROLES_METADATA_KEY } from '~/extensions/marketplace/application/decorators/marketplace-role.decorator';
import { MarketplaceRoleGuard } from '~/extensions/marketplace/application/guards/marketplace-role.guard';

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

function makeReflector({
  roles,
  access,
}: {
  roles?: string[];
  access?: { resource: string; action: string };
}): Reflector {
  return {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => {
      if (key === MARKETPLACE_ROLES_METADATA_KEY) return roles;
      if (key === MARKETPLACE_ACCESS_METADATA_KEY) return access;
      return undefined;
    }),
  } as any;
}

function makeCtx(req: any) {
  const gqlCtx = { req, currentMember: req?.currentMember };
  return {
    getType: () => 'graphql',
    getHandler: () => ({ name: 'handler' }) as any,
    getClass: () => ({ name: 'Resolver' }) as any,
    getArgs: () => [undefined, undefined, gqlCtx, undefined] as any,
    getArgByIndex: (i: number) => [undefined, undefined, gqlCtx, undefined][i],
    switchToHttp: () => ({ getRequest: () => req }) as any,
    switchToRpc: () => undefined as any,
    switchToWs: () => undefined as any,
  };
}

describe('MarketplaceRoleGuard (Story 1.8 — access-matrix)', () => {
  it('@RequireMarketplaceAccess Order:create, orderer → true', () => {
    const guard = new MarketplaceRoleGuard(
      makeReflector({ access: { resource: 'Order', action: 'create' } }),
      makeLogger()
    );
    const req = {
      headers: {},
      currentMember: {
        username: 'alice',
        core_roles: ['User'],
        marketplace_roles: ['orderer'],
      },
    };
    expect(guard.canActivate(makeCtx(req) as any)).toBe(true);
  });

  it('@RequireMarketplaceAccess KU:manage, только orderer → ForbiddenException + log', () => {
    const logger = makeLogger();
    const guard = new MarketplaceRoleGuard(
      makeReflector({ access: { resource: 'KU', action: 'manage' } }),
      logger
    );
    const req = {
      headers: {},
      currentMember: {
        username: 'alice',
        core_roles: ['User'],
        marketplace_roles: ['orderer'],
      },
    };
    expect(() => guard.canActivate(makeCtx(req) as any)).toThrow(ForbiddenException);
    const msg = (logger.warn as jest.Mock).mock.calls[0][0] as string;
    expect(msg).toContain('forbidden-attempt');
    expect(msg).toContain('requested_access=KU:manage');
  });

  it('Комбинация: @RequireMarketplaceRole admin + @RequireMarketplaceAccess Offer:moderate, admin → true', () => {
    const guard = new MarketplaceRoleGuard(
      makeReflector({
        roles: ['admin'],
        access: { resource: 'Offer', action: 'moderate' },
      }),
      makeLogger()
    );
    const req = {
      headers: {},
      currentMember: {
        username: 'chair',
        core_roles: ['User', 'Member', 'Chairman'],
        marketplace_roles: ['orderer', 'board_readonly', 'admin', 'board'],
      },
    };
    expect(guard.canActivate(makeCtx(req) as any)).toBe(true);
  });

  it('Комбинация: роль admin есть, но access не покрыт матрицей → отказ от access (логическое И)', () => {
    const guard = new MarketplaceRoleGuard(
      makeReflector({
        roles: ['admin'],
        access: { resource: 'KU', action: 'read:own-KU' }, // только operator
      }),
      makeLogger()
    );
    const req = {
      headers: {},
      currentMember: {
        username: 'chair',
        core_roles: ['User', 'Member', 'Chairman'],
        marketplace_roles: ['orderer', 'board_readonly', 'admin', 'board'],
      },
    };
    expect(() => guard.canActivate(makeCtx(req) as any)).toThrow(ForbiddenException);
  });

  it('server-secret пропускает оба требования', () => {
    const guard = new MarketplaceRoleGuard(
      makeReflector({
        roles: ['admin'],
        access: { resource: 'KU', action: 'manage' },
      }),
      makeLogger()
    );
    const req = { headers: { 'server-secret': 'svc-secret' } };
    expect(guard.canActivate(makeCtx(req) as any)).toBe(true);
  });

  it('Ни одного декоратора → guard разрешает (membership проверяется отдельно)', () => {
    const guard = new MarketplaceRoleGuard(makeReflector({}), makeLogger());
    expect(guard.canActivate(makeCtx({ headers: {} }) as any)).toBe(true);
  });
});
