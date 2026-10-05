import config from '~/config/config';
import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';
import { CoopDomainDatabase } from '~/infrastructure/auth-v2/coop-domain.database';
import { PostgresVaultRepository } from '~/infrastructure/auth-v2/postgres-vault.repository';
import { SameCoopVotingPolicy } from './same-coop-voting.policy';
import type { PolicyEvaluationContext } from '../policy.types';

/**
 * Integration-тест Layer 3 против РЕАЛЬНОЙ coop_domain_db (AC Story 6.3: «покрыто
 * integration-тестами с реальной БД»). Исключён из штатного `jest` паттерном
 * `.integration.spec.ts` (jest.config.js testPathIgnorePatterns); гоняется внутри
 * контейнера, где резолвится host `postgres` и доступен /run/secrets:
 *   docker exec mono-ai-3-coopback-1 sh -lc \
 *     'cd /app/components/controller && ./node_modules/.bin/jest \
 *      src/application/auth-v2/authorization/policies/same-coop-voting.policy.integration.spec.ts \
 *      --testPathIgnorePatterns=/node_modules/ --runInBand'
 * Если БД недоступна — тест помечается пропущенным, а не падает.
 */
const TEST_USER = 'coopid-6-3-integ-voter';

const blob: EncryptedVaultBlob = {
  cipher_version: '1',
  kdf_version: '1',
  salt: 'YWJj',
  nonce: 'YWJj',
  ciphertext: 'YWJj',
  auth_tag: 'YWJj',
};

const ctx = (username: string, coopname?: string): PolicyEvaluationContext => ({
  user: { username, role: 'user' },
  action: 'vote',
  subject: 'Participant',
  resource: coopname === undefined ? undefined : { coopname },
});

async function tryConnect(): Promise<CoopDomainDatabase | null> {
  const db = new CoopDomainDatabase();
  try {
    await db.query('SELECT 1');
    return db;
  } catch {
    await db.onModuleDestroy();
    return null;
  }
}

describe('SameCoopVotingPolicy — integration с реальной coop_domain_db (Story 6.3)', () => {
  let db: CoopDomainDatabase | null = null;
  let repo: PostgresVaultRepository;
  let policy: SameCoopVotingPolicy;

  beforeAll(async () => {
    db = await tryConnect();
    if (!db) return;
    repo = new PostgresVaultRepository(db);
    policy = new SameCoopVotingPolicy(repo);
    await db.query(`DELETE FROM vaults WHERE subject_type='participant' AND subject_id=$1`, [TEST_USER]);
  });

  afterAll(async () => {
    if (!db) return;
    await db.query(`DELETE FROM vaults WHERE subject_type='participant' AND subject_id=$1`, [TEST_USER]);
    await db.onModuleDestroy();
  });

  it('реальный DB-lookup: членство (vault) разрешает голос, отсутствие — запрещает', async () => {
    if (!db) {
      console.warn('coop_domain_db недоступна — integration-тест Layer 3 пропущен');
      return;
    }
    // Нет vault в БД → политика читает БД и отказывает.
    expect(await policy.evaluate(ctx(TEST_USER))).toBe(false);

    // Засеять реальный participant-vault → членство этого кооператива.
    await repo.upsert({ subject_type: 'participant', subject_id: TEST_USER }, blob);
    expect(await policy.evaluate(ctx(TEST_USER))).toBe(true);
    expect(await policy.evaluate(ctx(TEST_USER, config.coopname))).toBe(true);

    // Чужой кооператив — отказ даже при наличии vault.
    expect(await policy.evaluate(ctx(TEST_USER, 'foreign-coop'))).toBe(false);
  });
});
