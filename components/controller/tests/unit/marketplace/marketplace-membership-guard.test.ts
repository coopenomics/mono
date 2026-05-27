/**
 * Unit-тесты MarketplaceMembershipGuard.
 *
 * Story 1.3 (auth/active/server-secret) + Story 3.1 (isOfferer source — whitelist).
 *
 * Покрывают AC:
 *   (a) пайщик с user.role='user', status=active, whitelist пуст → guard
 *       пропускает, marketplace_roles=['orderer','offerer'] (open vitrine);
 *   (b) пайщик с user.role='user', whitelist непустой и пайщика там нет →
 *       marketplace_roles=['orderer'] (без offerer);
 *   (c) member и chairman дают расширенный core_roles + marketplace_roles;
 *   (d) status != active → ForbiddenException (HTTP 403);
 *   (e) no user → UnauthorizedException (HTTP 401);
 *   (f) server-secret bypass — guard true, currentMember не выставлен.
 */
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { MarketplaceMembershipGuard } from '~/extensions/marketplace/application/guards/marketplace-membership.guard';
import type { MarketplaceKuChairmanService } from '~/extensions/marketplace/application/services/marketplace-ku-chairman.service';
import type { MarketplaceWhitelistService } from '~/extensions/marketplace/application/services/marketplace-whitelist.service';

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    server_secret: 'test-secret',
    coopname: 'voskhod',
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

function makeWhitelistService(isOffererResult: boolean): MarketplaceWhitelistService {
  return {
    isOfferer: jest.fn().mockResolvedValue(isOffererResult),
  } as unknown as MarketplaceWhitelistService;
}

function makeKuChairmanService(isKuChairmanResult: boolean): MarketplaceKuChairmanService {
  return {
    isKuChairman: jest.fn().mockResolvedValue(isKuChairmanResult),
  } as unknown as MarketplaceKuChairmanService;
}

describe('MarketplaceMembershipGuard', () => {
  it('user.role=user, status=active, whitelist пуст → ctx [User] + marketplace_roles [orderer, offerer]', async () => {
    const guard = new MarketplaceMembershipGuard(makeWhitelistService(true), makeKuChairmanService(false));
    const req = { user: { username: 'alice', role: 'user', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect((ctx as any)._gqlCtx.currentMember).toEqual({
      username: 'alice',
      core_roles: ['User'],
      marketplace_roles: ['orderer', 'offerer'],
    });
    expect(req).toHaveProperty('currentMember');
  });

  it('user.role=user, whitelist непустой и пайщика там нет → marketplace_roles [orderer] (без offerer)', async () => {
    const guard = new MarketplaceMembershipGuard(makeWhitelistService(false), makeKuChairmanService(false));
    const req = { user: { username: 'alice', role: 'user', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect((ctx as any)._gqlCtx.currentMember.marketplace_roles).toEqual(['orderer']);
  });

  it('user.role=member, status=active → core_roles [User, Member] + marketplace_roles [orderer, offerer, board_readonly]', async () => {
    const guard = new MarketplaceMembershipGuard(makeWhitelistService(true), makeKuChairmanService(false));
    const req = { user: { username: 'bob', role: 'member', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);
    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect((ctx as any)._gqlCtx.currentMember.core_roles).toEqual(['User', 'Member']);
    expect((ctx as any)._gqlCtx.currentMember.marketplace_roles).toEqual([
      'orderer',
      'offerer',
      'board_readonly',
    ]);
  });

  it('user.role=chairman, status=active → marketplace_roles полный набор', async () => {
    const guard = new MarketplaceMembershipGuard(makeWhitelistService(true), makeKuChairmanService(false));
    const req = { user: { username: 'chair', role: 'chairman', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);
    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect((ctx as any)._gqlCtx.currentMember.core_roles).toEqual(['User', 'Member', 'Chairman']);
    expect((ctx as any)._gqlCtx.currentMember.marketplace_roles).toEqual([
      'orderer',
      'offerer',
      'board_readonly',
      'admin',
      'board',
    ]);
  });

  it('status != active → 403 Forbidden «Доступ только для пайщиков кооператива»', async () => {
    const guard = new MarketplaceMembershipGuard(makeWhitelistService(false), makeKuChairmanService(false));
    const req = { user: { username: 'alice', role: 'user', status: '4_Registered' }, headers: {} };
    const ctx = makeCtx(req);
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(
      'Доступ только для пайщиков кооператива'
    );
  });

  it('нет user (нет JWT) → 401 Unauthorized', async () => {
    const guard = new MarketplaceMembershipGuard(makeWhitelistService(false), makeKuChairmanService(false));
    const req = { headers: {} };
    const ctx = makeCtx(req);
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(UnauthorizedException);
  });

  it('server-secret bypass → true, currentMember не выставляется, whitelist/branches не дёргаются', async () => {
    const ws = makeWhitelistService(true);
    const ku = makeKuChairmanService(false);
    const guard = new MarketplaceMembershipGuard(ws, ku);
    const req = { headers: { 'server-secret': 'test-secret' } };
    const ctx = makeCtx(req);
    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect((ctx as any)._gqlCtx.currentMember).toBeUndefined();
    expect(ws.isOfferer).not.toHaveBeenCalled();
    expect(ku.isKuChairman).not.toHaveBeenCalled();
  });

  it('isKuChairman=true → marketplace_roles содержит operator', async () => {
    const guard = new MarketplaceMembershipGuard(makeWhitelistService(false), makeKuChairmanService(true));
    const req = { user: { username: 'chairkrg', role: 'user', status: 'active' }, headers: {} };
    const ctx = makeCtx(req);
    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect((ctx as any)._gqlCtx.currentMember.marketplace_roles).toEqual(['orderer', 'operator']);
  });
});
