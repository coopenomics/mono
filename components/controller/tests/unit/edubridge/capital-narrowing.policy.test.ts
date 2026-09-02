/**
 * Политика сосуществования «Образовательного моста» с «Благоростом»:
 * столы capital — преподавателям и совету, оферты capital при вступлении скрыты,
 * всё выключается настройкой capital_integration.
 */
import { EdubridgeCapitalNarrowingPolicy } from '~/extensions/edubridge/application/policies/edubridge-capital-narrowing.policy';
import { EdubridgeConfigHolder } from '~/extensions/edubridge/application/config/edubridge-config.holder';
import { defaultConfig } from '~/extensions/edubridge/types';

function make(opts: { teacher?: boolean; enabled?: boolean } = {}) {
  const grantsFilters = { register: jest.fn(), unregister: jest.fn() };
  const offerFilters = { register: jest.fn(), unregister: jest.fn() };
  const facts = { resolve: jest.fn(async () => ({ isLearner: false, hasTeacherOffer: !!opts.teacher, isTeacher: !!opts.teacher, isAdmin: false })) };
  const holder = new EdubridgeConfigHolder({ get: async () => null } as any);
  holder.set({ ...defaultConfig, capital_integration: opts.enabled ?? true });
  const policy = new EdubridgeCapitalNarrowingPolicy(grantsFilters, offerFilters, facts, holder);
  return { policy, grantsFilters, offerFilters, facts };
}

const capitalTarget = { extensionName: 'capital', grants: ['Capital:access', 'Capital:board'] };
const ctx = (userRole?: string, username = 'ant') => ({ coopname: 'voskhod', username, userRole });

describe('EdubridgeCapitalNarrowingPolicy', () => {
  it('регистрируется в обоих реестрах и снимается при остановке', () => {
    const { policy, grantsFilters, offerFilters } = make();
    policy.onModuleInit();
    expect(grantsFilters.register).toHaveBeenCalledWith(policy);
    expect(offerFilters.register).toHaveBeenCalledWith(policy);
    policy.onModuleDestroy();
    expect(grantsFilters.unregister).toHaveBeenCalledWith('edubridge');
    expect(offerFilters.unregister).toHaveBeenCalledWith('edubridge');
  });

  it('рядовому пайщику без роли преподавателя столы Благороста не показывает', async () => {
    const { policy } = make({ teacher: false });
    await expect(policy.filterGrants(capitalTarget, ctx('user'))).resolves.toEqual([]);
  });

  it('преподавателю оставляет всё, что выдал Благорост', async () => {
    const { policy } = make({ teacher: true });
    await expect(policy.filterGrants(capitalTarget, ctx('user'))).resolves.toEqual(capitalTarget.grants);
  });

  it('совет и председатель Благорост видят независимо от роли преподавателя', async () => {
    const { policy, facts } = make({ teacher: false });
    await expect(policy.filterGrants(capitalTarget, ctx('chairman'))).resolves.toEqual(capitalTarget.grants);
    await expect(policy.filterGrants(capitalTarget, ctx('member'))).resolves.toEqual(capitalTarget.grants);
    expect(facts.resolve).not.toHaveBeenCalled();
  });

  it('гостю стол Благороста не показывает', async () => {
    const { policy } = make();
    await expect(policy.filterGrants(capitalTarget, { coopname: 'voskhod' })).resolves.toEqual([]);
  });

  it('чужие столы, кроме capital, не трогает', async () => {
    const { policy } = make({ teacher: false });
    const target = { extensionName: 'market', grants: ['Order:create'] };
    await expect(policy.filterGrants(target, ctx('user'))).resolves.toEqual(['Order:create']);
  });

  it('скрывает программы и оферты Благороста при вступлении, остальные оставляет', () => {
    const { policy } = make();
    const programs = [
      { key: 'CAPITALIZATION', extension_name: 'capital' },
      { key: 'MARKETPLACE', extension_name: 'market' },
    ] as any[];
    const agreements = [
      { id: 'blagorost_offer', extension_name: 'capital' },
      { id: 'marketplace_offer', extension_name: 'market' },
    ] as any[];
    expect(policy.filterPrograms(programs)).toEqual(['MARKETPLACE']);
    expect(policy.filterAgreements(agreements)).toEqual(['marketplace_offer']);
  });

  it('при выключенной связке ничего не сужает', async () => {
    const { policy } = make({ teacher: false, enabled: false });
    await expect(policy.filterGrants(capitalTarget, ctx('user'))).resolves.toEqual(capitalTarget.grants);
    expect(policy.filterPrograms([{ key: 'CAPITALIZATION', extension_name: 'capital' }] as any)).toEqual(['CAPITALIZATION']);
  });
});
