import { VaultService } from '~/application/auth-v2/vault/vault.service';
import { VaultServerDecryptionForbiddenError } from '~/domain/auth-v2/errors/auth-v2.error';
import type { IVaultRepository } from '~/domain/auth-v2/vault/vault-repository.port';
import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';

const BLOB: EncryptedVaultBlob = {
  cipher_version: 'aes-256-gcm-v1',
  kdf_version: 'argon2id-v1',
  salt: 'c2FsdA',
  nonce: 'bm9uY2U',
  ciphertext: 'Y2lwaGVy',
  auth_tag: 'dGFn',
};

function makeRepo() {
  const store = new Map<string, EncryptedVaultBlob>();
  const repo: IVaultRepository = {
    upsert: jest.fn(async (s, b) => void store.set(`${s.subject_type}:${s.subject_id}`, b)),
    find: jest.fn(async (s) => store.get(`${s.subject_type}:${s.subject_id}`) ?? null),
  };
  return { repo, store };
}

describe('VaultService', () => {
  it('store → repo.upsert по субъекту', async () => {
    const { repo, store } = makeRepo();
    const svc = new VaultService(repo);
    await svc.store({ subject_type: 'participant', subject_id: 'ant' }, BLOB);
    expect(store.get('participant:ant')).toEqual(BLOB);
  });

  it('retrieve возвращает зашифрованный blob, не расшифровывает', async () => {
    const { repo } = makeRepo();
    const svc = new VaultService(repo);
    await svc.store({ subject_type: 'participant', subject_id: 'ant' }, BLOB);
    const got = await svc.retrieve({ subject_type: 'participant', subject_id: 'ant' });
    expect(got).toEqual(BLOB);
  });

  it('retrieve несуществующего → null', async () => {
    const { repo } = makeRepo();
    expect(await new VaultService(repo).retrieve({ subject_type: 'participant', subject_id: 'nobody' })).toBeNull();
  });

  it('серверная расшифровка участника запрещена в рантайме', () => {
    const { repo } = makeRepo();
    expect(() => new VaultService(repo).assertNoServerDecrypt()).toThrow(VaultServerDecryptionForbiddenError);
  });
});
