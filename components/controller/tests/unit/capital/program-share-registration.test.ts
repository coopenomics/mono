/**
 * Автоматическая регистрация долей держателей Благороста: баланс и проекты.
 *
 * До 25.09.2026 (C28-80) слушатель дельты кошелька читал баланс из зеркала,
 * которое ту же дельту пишет параллельно, — и получал баланс до взноса: доля
 * в активном проекте оставалась старой. Ещё автоматика пыталась заводить доли
 * в личные (локальные) проекты, которых нет в цепи.
 */
import { ProgramShareRegistrationService } from '~/extensions/capital/application/services/program-share-registration.service';
import { ProgramShareRegistrationOnUserWalletDeltaListener } from '~/extensions/capital/application/listeners/program-share-registration-on-user-wallet-delta.listener';
import { ProjectOrigin } from '~/extensions/capital/domain/enums/project-origin.enum';
import { ProjectStatus } from '~/extensions/capital/domain/enums/project-status.enum';
import { ContributorStatus } from '~/extensions/capital/domain/enums/contributor-status.enum';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

function build() {
  const contributors = { findAll: jest.fn(async () => [{ coopname: 'voskhod', username: 'ant', status: ContributorStatus.ACTIVE }]) };
  const projects = {
    findAll: jest.fn(async () => [
      { coopname: 'voskhod', status: ProjectStatus.ACTIVE, project_hash: 'chain', origin: ProjectOrigin.BLOCKCHAIN },
      { coopname: 'voskhod', status: ProjectStatus.ACTIVE, project_hash: 'local', origin: ProjectOrigin.LOCAL },
    ]),
  };
  const chain = {
    getSegmentByProjectUser: jest.fn(async () => ({ capital_contributor_shares: '700.0000 RUB' })),
    registerShare: jest.fn(async () => undefined),
  };
  // Зеркало отстало: в нём ещё баланс до взноса.
  const wallets = { getProgramWallet: jest.fn(async () => ({ available: '700.0000 RUB', blocked: '0.0000 RUB' })) };
  const service = new ProgramShareRegistrationService(contributors as any, projects as any, chain as any, wallets as any);
  return { service, chain, wallets };
}

describe('автоматическая регистрация долей: баланс из дельты, только проекты цепи', () => {
  it('дельта кошелька несёт новый баланс — доля в активном проекте догоняет его, зеркало не читается', async () => {
    const m = build();
    const listener = new ProgramShareRegistrationOnUserWalletDeltaListener(m.service);

    await listener.handleUserWalletDelta({
      present: true,
      scope: 'voskhod',
      value: { wallet_name: 'w.cap.blago', username: 'ant', available: '1000.0000 RUB', blocked: '0.0000 RUB' },
    } as any);

    expect(m.wallets.getProgramWallet).not.toHaveBeenCalled();
    expect(m.chain.registerShare).toHaveBeenCalledTimes(1);
    expect(m.chain.registerShare).toHaveBeenCalledWith(
      expect.objectContaining({ project_hash: 'chain', username: 'ant', user_shares: '1000.0000 RUB' })
    );
  });

  it('личный проект вне цепи доли не получает', async () => {
    const m = build();

    await m.service.syncProgramSharesForUser('voskhod', 'ant', '1000.0000 RUB');

    const hashes = m.chain.registerShare.mock.calls.map(([arg]: any[]) => arg.project_hash);
    expect(hashes).toEqual(['chain']);
  });
});
