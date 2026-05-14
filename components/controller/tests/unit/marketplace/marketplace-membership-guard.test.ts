/**
 * Unit-тесты MarketplaceMembershipGuard (Story 1.3).
 *
 * Покрывают AC:
 *   (a) пайщик с user.role='user', status=active → guard пропускает, в
 *       request.currentMember / ctx.currentMember лежит { core_roles:['User'],
 *       marketplace_roles:[] };
 *   (b) member и chairman дают расширенный core_roles;
 *   (c) status != active → ForbiddenException (HTTP 403 «Доступ только для
 *       пайщиков кооператива»);
 *   (d) no user → UnauthorizedException (HTTP 401);
 *   (e) server-secret bypass — guard true, currentMember не выставлен.
 */
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { MarketplaceMembershipGuard } from '~/extensions/marketplace/application/guards/marketplace-membership.guard';

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    server_secret: 'test-secret',
  },
}));

function makeCtx(req: any) {
  const gqlCtx = { req, currentMember: undefined as any };
  return {
    getType: () => 'graphql',
    getHandler: () => undefined,
    getClass: () => undefined,
    getArgs: () => [undefined, undefined, gqlCtx, undefined],
    getArgByIndex: (i: number) => [undefined, undefined, gqlCtx, undefined][i],
    switchToHttp: () => ({ getRequest: () => req }) as any,
    switchToRpc: () => undefined as any,
    switchToWs: () => undefined as any,
    _gqlCtx: gqlCtx,
  };
}

describe('MarketplaceMembershipGuard', () => {
  let guard: MarketplaceMembershipGuard;

  beforeEach(() => {
    guard = new MarketplaceMembershipGuard();
  });

  it('user.role=user, status=active → пропускает, в ctx [User]', () => {
    const req = { user: { username: 'alice', role: 'user', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);

    expect(guard.canActivate(ctx as any)).toBe(true);
    expect((ctx as any)._gqlCtx.currentMember).toEqual({
      username: 'alice',
      core_roles: ['User'],
      marketplace_roles: [],
    });
    expect(req).toHaveProperty('currentMember');
  });

  it('user.role=member, status=active → core_roles [User, Member]', () => {
    const req = { user: { username: 'bob', role: 'member', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);
    expect(guard.canActivate(ctx as any)).toBe(true);
    expect((ctx as any)._gqlCtx.currentMember.core_roles).toEqual(['User', 'Member']);
  });

  it('user.role=chairman, status=active → core_roles [User, Member, Chairman]', () => {
    const req = { user: { username: 'chair', role: 'chairman', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);
    expect(guard.canActivate(ctx as any)).toBe(true);
    expect((ctx as any)._gqlCtx.currentMember.core_roles).toEqual(['User', 'Member', 'Chairman']);
  });

  it('status != active → 403 Forbidden «Доступ только для пайщиков кооператива»', () => {
    const req = { user: { username: 'alice', role: 'user', status: '4_Registered' }, headers: {} };
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as any)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx as any)).toThrow('Доступ только для пайщиков кооператива');
  });

  it('нет user (нет JWT) → 401 Unauthorized', () => {
    const req = { headers: {} };
    const ctx = makeCtx(req);
    expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
  });

  it('server-secret bypass → true, currentMember не выставляется', () => {
    const req = { headers: { 'server-secret': 'test-secret' } };
    const ctx = makeCtx(req);
    expect(guard.canActivate(ctx as any)).toBe(true);
    expect((ctx as any)._gqlCtx.currentMember).toBeUndefined();
  });
});
