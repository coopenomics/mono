import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import type { RobotKeyDomainEntity } from '../../domain/entities/robot-key.entity';
import type { RobotKeyRepository, RobotKeyUpsert } from '../../domain/repositories/robot-key.repository';
import type { DB } from '../database/soviet-robot.database.types';

/** Ключи подписи, доверенные роботу членами совета (таблица `soviet_robot_keys`). */
@Injectable()
export class RobotKeyKyselyRepository implements RobotKeyRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async findByMember(coopname: string, member: string): Promise<RobotKeyDomainEntity | null> {
    const row = await this.db
      .selectFrom('soviet_robot_keys')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('member', '=', member)
      .executeTakeFirst();
    return row ?? null;
  }

  async findAll(coopname: string): Promise<RobotKeyDomainEntity[]> {
    return this.db.selectFrom('soviet_robot_keys').selectAll().where('coopname', '=', coopname).execute();
  }

  /** У члена совета один ключ: повторная передача заменяет прежний. */
  async upsert(data: RobotKeyUpsert): Promise<RobotKeyDomainEntity> {
    const existing = await this.findByMember(data.coopname, data.member);
    if (existing) {
      return this.db
        .updateTable('soviet_robot_keys')
        .set({
          permission_name: data.permission_name,
          encrypted_wif: data.encrypted_wif,
          public_key: data.public_key,
          updated_at: sql`now()`,
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    return this.db.insertInto('soviet_robot_keys').values(data).returningAll().executeTakeFirstOrThrow();
  }

  async deleteByMember(coopname: string, member: string): Promise<boolean> {
    const rows = await this.db
      .deleteFrom('soviet_robot_keys')
      .where('coopname', '=', coopname)
      .where('member', '=', member)
      .returningAll()
      .execute();
    return rows.length > 0;
  }
}
