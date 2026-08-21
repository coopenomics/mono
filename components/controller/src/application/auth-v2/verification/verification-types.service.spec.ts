import config from '~/config/config';
import {
  VerificationSource,
  VerificationStatus,
  VerificationType,
} from '~/domain/auth-v2/verification/verification.types';
import { BaselineVerificationResolver } from './resolvers/baseline-verification.resolver';
import { ChainVerificationResolver } from './resolvers/chain-verification.resolver';
import { VerificationTypesService } from './verification-types.service';

function makeStack({ participant = null as any, userAccount = null as any } = {}) {
  const accountDomain = {
    getParticipantAccount: jest.fn().mockResolvedValue(participant),
    getUserAccount: jest.fn().mockResolvedValue(userAccount),
  };
  const baseline = new BaselineVerificationResolver(accountDomain as any);
  const chain = new ChainVerificationResolver(accountDomain as any);
  const service = new VerificationTypesService([baseline, chain]);
  return { service, accountDomain };
}

function participantRow(over: Record<string, any> = {}) {
  return { username: 'ant', status: 'accepted', created_at: '2026-01-02T03:04:05', ...over };
}

function chainVerification(over: Record<string, any> = {}) {
  return {
    verificator: 'trustee1',
    is_verified: true,
    procedure: 'passport',
    created_at: '2026-02-03T04:05:06',
    last_update: '2026-02-03T04:05:06',
    notice: 'voskhod/braname1',
    ...over,
  };
}

describe('VerificationTypesService.resolveForUsername (Stories 4.1/4.2, фабрика источников)', () => {
  it('принятый член → coop_baseline: verified, источник cooperative_decision, verified_at = дата приёма (UTC)', async () => {
    const { service, accountDomain } = makeStack({ participant: participantRow() });
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
    const { service } = makeStack({ participant: participantRow({ created_at: '2026-01-02T03:04:05Z' }) });
    const [entry] = await service.resolveForUsername('ant');
    expect(entry.verified_at).toBe('2026-01-02T03:04:05.000Z');
  });

  it('нет записи участника (не член) → пустой список типов', async () => {
    const { service } = makeStack();
    await expect(service.resolveForUsername('stranger')).resolves.toEqual([]);
  });

  it('заблокированный член (status=blocked) → baseline не выдаётся', async () => {
    const { service } = makeStack({ participant: participantRow({ status: 'blocked' }) });
    await expect(service.resolveForUsername('ant')).resolves.toEqual([]);
  });

  it('coopname можно передать явно (мульти-кооп вызов)', async () => {
    const { service, accountDomain } = makeStack({ participant: participantRow() });
    await service.resolveForUsername('ant', 'othercoop');
    expect(accountDomain.getParticipantAccount).toHaveBeenCalledWith('othercoop', 'ant');
  });

  it('он-чейн запись passport → passport_onsite с attested_by и источником branch_attestation', async () => {
    const { service } = makeStack({
      participant: participantRow(),
      userAccount: { username: 'ant', verifications: [chainVerification()] },
    });
    const types = await service.resolveForUsername('ant');

    expect(types).toContainEqual({
      type: VerificationType.PassportOnsite,
      status: VerificationStatus.Verified,
      source: VerificationSource.BranchAttestation,
      verified_at: '2026-02-03T04:05:06.000Z',
      attested_by: 'trustee1',
    });
    // Начальный уровень при этом сохраняется — уровни независимы.
    expect(types.map((t) => t.type)).toEqual([VerificationType.CoopBaseline, VerificationType.PassportOnsite]);
  });

  it('отозванная (is_verified=false) и незнакомая (online) процедуры уровня не дают', async () => {
    const { service } = makeStack({
      userAccount: {
        username: 'ant',
        verifications: [
          chainVerification({ is_verified: false }),
          chainVerification({ procedure: 'online', verificator: 'ano', notice: '' }),
        ],
      },
    });
    await expect(service.resolveForUsername('ant')).resolves.toEqual([]);
  });

  it('дубликат типа из двух источников схлопывается — выигрывает более ранний источник', async () => {
    const accountDomain = {
      getParticipantAccount: jest.fn().mockResolvedValue(participantRow()),
      getUserAccount: jest.fn().mockResolvedValue(null),
    };
    const baseline = new BaselineVerificationResolver(accountDomain as any);
    const duplicate = new BaselineVerificationResolver(accountDomain as any);
    const service = new VerificationTypesService([baseline, duplicate]);

    const types = await service.resolveForUsername('ant');
    expect(types).toHaveLength(1);
    expect(types[0].type).toBe(VerificationType.CoopBaseline);
  });
});
