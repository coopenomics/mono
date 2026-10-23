import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type { CooperativeCharterRepository } from '~/domain/cooperative-charter/repositories/cooperative-charter.repository';
import type { ICooperativeCharterDatabaseData } from '~/domain/cooperative-charter/interfaces/cooperative-charter-database.interface';
import type { CooperativeCharters } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

function toDomain(row: Selectable<CooperativeCharters>): ICooperativeCharterDatabaseData {
  return {
    id: row.id,
    coopname: row.coopname,
    username: row.username,
    checksum_sha256: row.checksum_sha256,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    storage_key: row.storage_key,
    original_filename: row.original_filename,
    uploaded_by_username: row.uploaded_by_username,
    uploaded_at: row.uploaded_at,
  };
}

/** Уставы кооперативов, приложенные к заявке на подключение (таблица `cooperative_charters`). */
@Injectable()
export class CooperativeCharterKyselyRepository implements CooperativeCharterRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(data: ICooperativeCharterDatabaseData): Promise<ICooperativeCharterDatabaseData> {
    const row = await this.db
      .insertInto('cooperative_charters')
      .values({
        coopname: data.coopname,
        username: data.username,
        checksum_sha256: data.checksum_sha256,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        storage_key: data.storage_key,
        original_filename: data.original_filename ?? null,
        uploaded_by_username: data.uploaded_by_username,
        ...(data.uploaded_at ? { uploaded_at: data.uploaded_at } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findById(id: number): Promise<ICooperativeCharterDatabaseData | null> {
    const row = await this.db.selectFrom('cooperative_charters').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findLatestByUsername(coopname: string, username: string): Promise<ICooperativeCharterDatabaseData | null> {
    const row = await this.db
      .selectFrom('cooperative_charters')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('username', '=', username)
      .orderBy('uploaded_at', 'desc')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findLatestForUsernames(coopname: string, usernames: string[]): Promise<ICooperativeCharterDatabaseData[]> {
    if (usernames.length === 0) return [];
    const rows = await this.db
      .selectFrom('cooperative_charters')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('username', 'in', usernames)
      .orderBy('uploaded_at', 'desc')
      .orderBy('id', 'desc')
      .execute();
    // Реестр показывает по одному — последнему — уставу на кооператив.
    const latest = new Map<string, Selectable<CooperativeCharters>>();
    for (const row of rows) if (!latest.has(row.username)) latest.set(row.username, row);
    return [...latest.values()].map(toDomain);
  }

  async delete(id: number): Promise<void> {
    await this.db.deleteFrom('cooperative_charters').where('id', '=', id).execute();
  }
}
