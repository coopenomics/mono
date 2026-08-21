import config from '~/config/config';
import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';
import type { IVaultRepository } from '~/domain/auth-v2/vault/vault-repository.port';
import { SameCoopVotingPolicy } from './same-coop-voting.policy';
import type { PolicyEvaluationContext } from '../policy.types';

const blob: EncryptedVaultBlob = {
  cipher_version: '1',
  kdf_version: '1',
  salt: 's',
  nonce: 'n',
  ciphertext: 'c',
  auth_tag: 't',
};

/** Vault-репозиторий с фиксированным множеством пайщиков, у кого есть CoopID. */
function vaultRepoWith(members: string[]): IVaultRepository {
  return {
    upsert: async () => undefined,
    find: async (subject) =>
      subject.subject_type === 'participant' && members.includes(subject.subject_id) ? blob : null,
  };
}

const ctx = (username: string, coopname?: string): PolicyEvaluationContext => ({
  user: { username, role: 'user' },
  action: 'vote',
  subject: 'CriticalAction',
  resource: coopname === undefined ? undefined : { coopname },
});

describe('SameCoopVotingPolicy — Layer 3 (Story 6.3)', () => {
  it('пайщик с CoopID этого кооператива — может голосовать', async () => {
    const policy = new SameCoopVotingPolicy(vaultRepoWith(['ant']));
    expect(await policy.evaluate(ctx('ant'))).toBe(true);
    expect(await policy.evaluate(ctx('ant', config.coopname))).toBe(true);
  });

  it('решение чужого кооператива — отказ (контроллер per-coop)', async () => {
    const policy = new SameCoopVotingPolicy(vaultRepoWith(['ant']));
    expect(await policy.evaluate(ctx('ant', 'foreign-coop'))).toBe(false);
  });

  it('без CoopID-vault (не пайщик этого кооператива) — отказ', async () => {
    const policy = new SameCoopVotingPolicy(vaultRepoWith([]));
    expect(await policy.evaluate(ctx('stranger'))).toBe(false);
  });

  it('пустой username — отказ', async () => {
    const policy = new SameCoopVotingPolicy(vaultRepoWith(['ant']));
    expect(await policy.evaluate(ctx(''))).toBe(false);
  });

  it('имя совпадает с реестром (для @PolicyHandler/@CheckAbility)', () => {
    expect(new SameCoopVotingPolicy(vaultRepoWith([])).name).toBe('same-coop-voting');
  });
});
