import type { CapabilitySetService } from './capability-set.service';
import { AuthorizationResolver } from './authorization.resolver';

const CURRENT_USER = { id: 'u1', username: 'chairman1', role: 'chairman' };

function build() {
  const service = {
    listSets: jest.fn(async () => [
      {
        setKey: 'accountant',
        title: 'Бухгалтер',
        description: 'Стол бухгалтера',
        builtin: true,
        coopname: null,
        grants: [{ action: 'read', resource: 'AccountingDesk' }],
      },
    ]),
    listForParticipant: jest.fn(async () => [
      {
        username: 'payer1',
        setKey: 'cashier',
        grantedBy: 'chairman1',
        grantedAt: '2026-06-13T00:00:00Z',
        expiresAt: null,
      },
    ]),
    getMyAccess: jest.fn(async () => ({
      sets: ['accountant'],
      grants: [{ action: 'read', resource: 'AccountingDesk' }],
    })),
    assign: jest.fn(async () => undefined),
    revoke: jest.fn(async () => undefined),
  };
  const resolver = new AuthorizationResolver(service as unknown as CapabilitySetService);
  return { resolver, service };
}

describe('AuthorizationResolver', () => {
  it('getCapabilitySets маппит в snake_case вместе с грантами', async () => {
    const { resolver } = build();
    expect(await resolver.getCapabilitySets()).toEqual([
      {
        set_key: 'accountant',
        title: 'Бухгалтер',
        description: 'Стол бухгалтера',
        builtin: true,
        coopname: null,
        grants: [{ action: 'read', resource: 'AccountingDesk' }],
      },
    ]);
  });

  it('getParticipantCapabilitySets маппит назначение в snake_case', async () => {
    const { resolver, service } = build();
    const out = await resolver.getParticipantCapabilitySets('payer1');
    expect(service.listForParticipant).toHaveBeenCalledWith('payer1');
    expect(out).toEqual([
      {
        username: 'payer1',
        set_key: 'cashier',
        granted_by: 'chairman1',
        granted_at: '2026-06-13T00:00:00Z',
        expires_at: null,
      },
    ]);
  });

  it('getMyAccess передаёт username/role текущего пайщика и маппит гранты', async () => {
    const { resolver, service } = build();
    const out = await resolver.getMyAccess(CURRENT_USER);
    expect(service.getMyAccess).toHaveBeenCalledWith({ username: 'chairman1', role: 'chairman' });
    expect(out).toEqual({ sets: ['accountant'], grants: [{ action: 'read', resource: 'AccountingDesk' }] });
  });

  it('assignCapabilitySet ставит grantedBy = текущий пользователь и маппит set_key', async () => {
    const { resolver, service } = build();
    const ok = await resolver.assignCapabilitySet(
      { username: 'payer1', set_key: 'cashier', expires_at: null },
      CURRENT_USER,
    );
    expect(ok).toBe(true);
    expect(service.assign).toHaveBeenCalledWith({
      username: 'payer1',
      setKey: 'cashier',
      grantedBy: 'chairman1',
      expiresAt: null,
    });
  });

  it('revokeCapabilitySet зовёт revoke с revokedBy = текущий пользователь', async () => {
    const { resolver, service } = build();
    const ok = await resolver.revokeCapabilitySet({ username: 'payer1', set_key: 'cashier' }, CURRENT_USER);
    expect(ok).toBe(true);
    expect(service.revoke).toHaveBeenCalledWith('payer1', 'cashier', 'chairman1');
  });
});
