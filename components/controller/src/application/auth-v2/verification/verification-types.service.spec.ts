import config from '~/config/config';
import {
  VerificationSource,
  VerificationStatus,
  VerificationType,
} from '~/domain/auth-v2/verification/verification.types';
import { VerificationTypesService } from './verification-types.service';

function makeService(participant: any) {
  const accountDomain = {
    getParticipantAccount: jest.fn().mockResolvedValue(participant),
  };
  const service = new VerificationTypesService(accountDomain as any);
  return { service, accountDomain };
}

function participantRow(over: Record<string, any> = {}) {
  return { username: 'ant', status: 'accepted', created_at: '2026-01-02T03:04:05', ...over };
}

describe('VerificationTypesService.resolveForUsername (Story 4.1)', () => {
  it('принятый член → coop_baseline: verified, источник cooperative_decision, verified_at = дата приёма (UTC)', async () => {
    const { service, accountDomain } = makeService(participantRow());
    const types = await service.resolveForUsername('ant');

    expect(accountDomain.getParticipantAccount).toHaveBeenCalledWith(config.coopname, 'ant');
    expect(types).toEqual([
      {
        type: VerificationType.CoopBaseline,
        status: VerificationStatus.Verified,
        source: VerificationSource.CooperativeDecision,
        verified_at: '2026-01-02T03:04:05.000Z',
      },
    ]);
  });

  it('chain time_point с явной таймзоной не сдвигается повторно', async () => {
    const { service } = makeService(participantRow({ created_at: '2026-01-02T03:04:05Z' }));
    const [entry] = await service.resolveForUsername('ant');
    expect(entry.verified_at).toBe('2026-01-02T03:04:05.000Z');
  });

  it('нет записи участника (не член) → пустой список типов', async () => {
    const { service } = makeService(null);
    await expect(service.resolveForUsername('stranger')).resolves.toEqual([]);
  });

  it('заблокированный член (status=blocked) → baseline не выдаётся', async () => {
    const { service } = makeService(participantRow({ status: 'blocked' }));
    await expect(service.resolveForUsername('ant')).resolves.toEqual([]);
  });

  it('coopname можно передать явно (мульти-кооп вызов)', async () => {
    const { service, accountDomain } = makeService(participantRow());
    await service.resolveForUsername('ant', 'othercoop');
    expect(accountDomain.getParticipantAccount).toHaveBeenCalledWith('othercoop', 'ant');
  });
});
