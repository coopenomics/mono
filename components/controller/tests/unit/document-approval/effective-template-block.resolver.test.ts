import { EffectiveTemplateBlockResolver } from '~/infrastructure/generator/effective-template-block.resolver';
import { Cooperative } from 'cooptypes';

const R = Cooperative.Registry;

jest.mock('~/config/config', () => ({ __esModule: true, default: { coopname: 'voskhod' } }));

function build(opts: {
  approvals: Array<{ registry_id: number; version: number }>;
  current: Record<number, { version: number } | null>;
  lastBlock: Record<string, number | null>;
}) {
  const blockchainService = { getAllRows: jest.fn(async () => opts.approvals) } as any;
  const draftRegistry = {
    findTemplateAt: jest.fn(async (id: string | number) => opts.current[Number(id)] ?? null),
    findLastBlockOfVersion: jest.fn(async (id: string | number, version: number) => opts.lastBlock[`${id}:${version}`] ?? null),
  } as any;
  return { resolver: new EffectiveTemplateBlockResolver(blockchainService, draftRegistry), blockchainService, draftRegistry };
}

describe('EffectiveTemplateBlockResolver', () => {
  it('без утверждения читается текущее состояние', async () => {
    const { resolver } = build({ approvals: [], current: { [R.PrivacyPolicy.registry_id]: { version: 4 } }, lastBlock: {} });
    expect(await resolver.resolve(R.PrivacyPolicy.registry_id)).toBeUndefined();
  });

  it('утверждённая редакция совпадает с сетевой — текущее состояние, правки без номера доезжают', async () => {
    const { resolver, draftRegistry } = build({ approvals: [{ registry_id: R.PrivacyPolicy.registry_id, version: 4 }], current: { [R.PrivacyPolicy.registry_id]: { version: 4 } }, lastBlock: {} });
    expect(await resolver.resolve(R.PrivacyPolicy.registry_id)).toBeUndefined();
    expect(draftRegistry.findLastBlockOfVersion).not.toHaveBeenCalled();
  });

  it('в сети редакция новее утверждённой — последний блок утверждённой редакции', async () => {
    const { resolver, draftRegistry } = build({
      approvals: [{ registry_id: R.PrivacyPolicy.registry_id, version: 3 }],
      current: { [R.PrivacyPolicy.registry_id]: { version: 4 } },
      lastBlock: { [`${R.PrivacyPolicy.registry_id}:3`]: 777 },
    });
    expect(await resolver.resolve(String(R.PrivacyPolicy.registry_id))).toBe(777);
    expect(draftRegistry.findLastBlockOfVersion).toHaveBeenCalledWith(R.PrivacyPolicy.registry_id, 3);
  });

  it('истории утверждённой редакции в реестре нет — текущее состояние, а не падение', async () => {
    const { resolver } = build({ approvals: [{ registry_id: R.PrivacyPolicy.registry_id, version: 2 }], current: { [R.PrivacyPolicy.registry_id]: { version: 4 } }, lastBlock: {} });
    expect(await resolver.resolve(R.PrivacyPolicy.registry_id)).toBeUndefined();
  });

  it('утверждения читаются из цепи один раз до события approve', async () => {
    const { resolver, blockchainService } = build({ approvals: [], current: { [R.PrivacyPolicy.registry_id]: { version: 4 } }, lastBlock: {} });
    await resolver.resolve(R.PrivacyPolicy.registry_id);
    await resolver.resolve(R.WalletAgreement.registry_id);
    expect(blockchainService.getAllRows).toHaveBeenCalledTimes(1);
    resolver.onApproved();
    await resolver.resolve(R.PrivacyPolicy.registry_id);
    expect(blockchainService.getAllRows).toHaveBeenCalledTimes(2);
  });
});
