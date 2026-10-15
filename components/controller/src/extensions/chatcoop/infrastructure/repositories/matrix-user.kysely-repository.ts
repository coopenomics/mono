import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { KYSELY, camelRow, snakeRow } from '@coopenomics/extension-kit';
import { MatrixUserRepository } from '../../domain/repositories/matrix-user.repository';
import { MatrixUserDomainEntity } from '../../domain/entities/matrix-user.entity';
import type { DB } from '../database/chatcoop.database.types';

/** Учётные записи пайщиков на сервере чата (таблица `matrix_users`). */
@Injectable()
export class MatrixUserKyselyRepository implements MatrixUserRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async create(user: Omit<MatrixUserDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<MatrixUserDomainEntity> {
    const row = await this.db
      .insertInto('matrix_users')
      .values({
        coop_username: user.coopUsername,
        matrix_user_id: user.matrixUserId,
        matrix_username: user.matrixUsername,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return camelRow<MatrixUserDomainEntity>(row);
  }

  async findByCoopUsername(coopUsername: string): Promise<MatrixUserDomainEntity | null> {
    return this.findOneBy('coop_username', coopUsername);
  }

  async findByMatrixUserId(matrixUserId: string): Promise<MatrixUserDomainEntity | null> {
    return this.findOneBy('matrix_user_id', matrixUserId);
  }

  async findById(id: string): Promise<MatrixUserDomainEntity | null> {
    return this.findOneBy('id', id);
  }

  async update(id: string, user: Partial<MatrixUserDomainEntity>): Promise<MatrixUserDomainEntity> {
    const { coopUsername, matrixUserId, matrixUsername } = user;
    const row = await this.db
      .updateTable('matrix_users')
      .set({ ...snakeRow({ coopUsername, matrixUserId, matrixUsername }), updated_at: sql`now()` })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new Error('Matrix user not found after update');
    }
    return camelRow<MatrixUserDomainEntity>(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('matrix_users').where('id', '=', id).execute();
  }

  async findAll(): Promise<MatrixUserDomainEntity[]> {
    const rows = await this.db.selectFrom('matrix_users').selectAll().execute();
    return rows.map((row) => camelRow<MatrixUserDomainEntity>(row));
  }

  private async findOneBy(column: 'id' | 'coop_username' | 'matrix_user_id', value: string): Promise<MatrixUserDomainEntity | null> {
    const row = await this.db.selectFrom('matrix_users').selectAll().where(column, '=', value).executeTakeFirst();
    return row ? camelRow<MatrixUserDomainEntity>(row) : null;
  }
}
