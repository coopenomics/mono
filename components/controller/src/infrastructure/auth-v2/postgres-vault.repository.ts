import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import { IVaultRepository } from '~/domain/auth-v2/vault/vault-repository.port';
import type { EncryptedVaultBlob, VaultSubject } from '~/domain/auth-v2/vault/vault.types';

/**
 * Хранилище vault-блобов в coop_domain_db (таблица `vaults`, создана миграцией
 * V2.4.0). Общее соединение базы CoopID (`CoopDomainDatabase`): недоступность coop-postgres бьёт
 * только по vault-операциям, не по запуску coopback.
 */
@Injectable()
export class PostgresVaultRepository implements IVaultRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async upsert(subject: VaultSubject, blob: EncryptedVaultBlob): Promise<void> {
    await this.db.query(
      `INSERT INTO vaults (subject_type, subject_id, cipher_version, kdf_version, salt, nonce, ciphertext, auth_tag, updated_at)
       VALUES ($1,$2,$3,$4, decode($5,'base64'), decode($6,'base64'), decode($7,'base64'), decode($8,'base64'), now())
       ON CONFLICT (subject_type, subject_id) DO UPDATE SET
         cipher_version = EXCLUDED.cipher_version,
         kdf_version = EXCLUDED.kdf_version,
         salt = EXCLUDED.salt,
         nonce = EXCLUDED.nonce,
         ciphertext = EXCLUDED.ciphertext,
         auth_tag = EXCLUDED.auth_tag,
         updated_at = now()`,
      [
        subject.subject_type,
        subject.subject_id,
        blob.cipher_version,
        blob.kdf_version,
        b64UrlToB64(blob.salt),
        b64UrlToB64(blob.nonce),
        b64UrlToB64(blob.ciphertext),
        b64UrlToB64(blob.auth_tag),
      ],
    );
  }

  async find(subject: VaultSubject): Promise<EncryptedVaultBlob | null> {
    const rows: any[] = await this.db.query(
      `SELECT cipher_version, kdf_version,
              encode(salt,'base64') AS salt, encode(nonce,'base64') AS nonce,
              encode(ciphertext,'base64') AS ciphertext, encode(auth_tag,'base64') AS auth_tag
       FROM vaults WHERE subject_type=$1 AND subject_id=$2`,
      [subject.subject_type, subject.subject_id],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      cipher_version: r.cipher_version,
      kdf_version: r.kdf_version,
      salt: b64ToB64Url(r.salt),
      nonce: b64ToB64Url(r.nonce),
      ciphertext: b64ToB64Url(r.ciphertext),
      auth_tag: b64ToB64Url(r.auth_tag),
    };
  }
}

// Postgres decode(...,'base64') требует стандартный алфавит И padding;
// SDK шлёт base64url без padding — конвертируем и добиваем '=' до кратности 4.
function b64UrlToB64(s: string): string {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = std.length % 4;
  return pad ? std + '='.repeat(4 - pad) : std;
}
function b64ToB64Url(s: string): string {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
