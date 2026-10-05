import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type {
  MembershipExitRequest,
  MembershipExitRequestCreate,
  MembershipExitRequestRepository,
} from '~/domain/membership-exit/repositories/membership-exit-request.repository';
import type { MembershipExitRequests } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

/** Хранилище заявлений на выход до подтверждения (таблица `membership_exit_requests`). */
@Injectable()
export class MembershipExitRequestKyselyRepository implements MembershipExitRequestRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(data: MembershipExitRequestCreate): Promise<MembershipExitRequest> {
    const row = await this.db
      .insertInto('membership_exit_requests')
      .values({
        coopname: data.coopname,
        username: data.username,
        exit_hash: data.exit_hash,
        statement: JSON.stringify(data.statement),
        token: data.token,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toDomain(row);
  }

  async findByMember(coopname: string, username: string): Promise<MembershipExitRequest | null> {
    const row = await this.db
      .selectFrom('membership_exit_requests')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('username', '=', username)
      .executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async findByToken(token: string): Promise<MembershipExitRequest | null> {
    const row = await this.db
      .selectFrom('membership_exit_requests')
      .selectAll()
      .where('token', '=', token)
      .executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.deleteFrom('membership_exit_requests').where('id', '=', id).execute();
  }

  private toDomain(row: Selectable<MembershipExitRequests>): MembershipExitRequest {
    return {
      id: row.id,
      coopname: row.coopname,
      username: row.username,
      exit_hash: row.exit_hash,
      statement: row.statement as Record<string, unknown>,
      token: row.token,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
