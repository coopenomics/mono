import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import {
  type IKeyRevocationRepository,
  type KeyRevocation,
  type NewKeyRevocation,
} from '~/domain/auth-v2/ports/key-revocation.port';

interface Row {
  id: string;
  target_id: string;
  reason: string;
  revoked_by: string;
  revoked_at: Date | string;
  recovered_at: Date | string | null;
}

/**
 * Хранилище ручных отзывов ключей в coop_domain_db (таблица V2.4.10). Общее
 * соединение базы CoopID (`CoopDomainDatabase`).
 */
@Injectable()
export class PostgresKeyRevocationRepository implements IKeyRevocationRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async record(input: NewKeyRevocation): Promise<KeyRevocation> {
    const rows: Row[] = await this.db.query(
      `INSERT INTO revoked_keys (target_id, reason, revoked_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.targetId, input.reason, input.revokedBy],
    );
    return this.toDomain(rows[0]);
  }

  async findActive(targetId: string): Promise<KeyRevocation | null> {
    const rows: Row[] = await this.db.query(
      `SELECT * FROM revoked_keys WHERE target_id = $1 AND recovered_at IS NULL ORDER BY revoked_at DESC LIMIT 1`,
      [targetId],
    );
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async markRecovered(targetId: string): Promise<void> {
    await this.db.query(
      `UPDATE revoked_keys SET recovered_at = now() WHERE target_id = $1 AND recovered_at IS NULL`,
      [targetId],
    );
  }

  private toDomain(row: Row): KeyRevocation {
    return {
      id: row.id,
      targetId: row.target_id,
      reason: row.reason,
      revokedBy: row.revoked_by,
      revokedAt: new Date(row.revoked_at).toISOString(),
      recoveredAt: row.recovered_at ? new Date(row.recovered_at).toISOString() : null,
    };
  }
}
