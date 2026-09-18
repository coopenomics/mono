import { GamificationSchedulerService } from '../../../src/extensions/capital/infrastructure/services/gamification-scheduler.service';
import { ContributorStatus } from '../../../src/extensions/capital/domain/enums/contributor-status.enum';

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', environment: 'production' }),
}));

/**
 * Энергию обновляет действие цепи, и оно требует ровно активного договора УХД.
 * Пока планировщик брал всех, кроме явно неактивных, он каждые сутки бился в
 * ассерт контракта на одном и том же пайщике со статусом `import` (инцидент
 * 11–18.09.2026: 11 одинаковых ошибок за неделю на `spnpcpshemqp`).
 */
function contributor(username: string, blockchain_status: ContributorStatus | undefined) {
  return {
    username,
    coopname: 'voskhod',
    status: blockchain_status ?? ContributorStatus.UNDEFINED,
    blockchain_status,
    contract: { version: '1.0.0' },
  };
}

function buildScheduler(contributors: ReturnType<typeof contributor>[]) {
  const contributorRepository = {
    findAll: jest.fn().mockResolvedValue(contributors),
  };
  const blockchainPort = {
    refreshContributor: jest.fn().mockResolvedValue(undefined),
  };
  const scheduler = new GamificationSchedulerService(contributorRepository as never, blockchainPort as never);
  return { scheduler, blockchainPort };
}

function refreshAll(scheduler: GamificationSchedulerService): Promise<void> {
  return (scheduler as unknown as { refreshAllContributorsEnergy: () => Promise<void> }).refreshAllContributorsEnergy();
}

describe('GamificationSchedulerService', () => {
  it('обновляет энергию только участникам с активным договором УХД', async () => {
    const { scheduler, blockchainPort } = buildScheduler([
      contributor('active1', ContributorStatus.ACTIVE),
      contributor('imported', ContributorStatus.IMPORT),
      contributor('approved', ContributorStatus.APPROVED),
      contributor('pending', ContributorStatus.PENDING),
      contributor('inactive', ContributorStatus.INACTIVE),
      contributor('nochain', undefined),
    ]);

    await refreshAll(scheduler);

    expect(blockchainPort.refreshContributor).toHaveBeenCalledTimes(1);
    expect(blockchainPort.refreshContributor).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'active1' });
  });

  it('не трогает участников чужого кооператива', async () => {
    const foreign = { ...contributor('foreign', ContributorStatus.ACTIVE), coopname: 'pgrzosdeyuwg' };
    const { scheduler, blockchainPort } = buildScheduler([foreign, contributor('own', ContributorStatus.ACTIVE)]);

    await refreshAll(scheduler);

    expect(blockchainPort.refreshContributor).toHaveBeenCalledTimes(1);
    expect(blockchainPort.refreshContributor).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'own' });
  });

  it('отказ цепи на одном участнике не останавливает остальных', async () => {
    const { scheduler, blockchainPort } = buildScheduler([
      contributor('first', ContributorStatus.ACTIVE),
      contributor('second', ContributorStatus.ACTIVE),
    ]);
    blockchainPort.refreshContributor.mockRejectedValueOnce(new Error('assertion failure'));

    await refreshAll(scheduler);

    expect(blockchainPort.refreshContributor).toHaveBeenCalledTimes(2);
  });
});
