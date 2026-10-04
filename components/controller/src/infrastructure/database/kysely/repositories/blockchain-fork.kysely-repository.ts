import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type { ForkRepositoryPort } from '~/domain/parser/ports/fork-repository.port';
import type { ForkDomainInterface } from '~/domain/parser/interfaces/fork-domain.interface';
import type { BlockchainForks } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

const toFork = (row: Selectable<BlockchainForks>): ForkDomainInterface => ({ ...row, block_num: Number(row.block_num) });

/** Журнал форков цепи (таблица `blockchain_forks`). */
@Injectable()
export class BlockchainForkKyselyRepository implements ForkRepositoryPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async save(forkData: Omit<ForkDomainInterface, 'id' | 'created_at'>): Promise<ForkDomainInterface> {
    const row = await this.db
      .insertInto('blockchain_forks')
      .values({ chain_id: forkData.chain_id, block_num: forkData.block_num })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toFork(row);
  }

  async findById(id: string): Promise<ForkDomainInterface | null> {
    const row = await this.db.selectFrom('blockchain_forks').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toFork(row) : null;
  }

  async deleteAfterBlock(blockNum: number): Promise<void> {
    await this.db.deleteFrom('blockchain_forks').where('block_num', '>', String(blockNum)).execute();
  }

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('blockchain_forks')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async findLastByBlock(): Promise<ForkDomainInterface | null> {
    const row = await this.db.selectFrom('blockchain_forks').selectAll().orderBy('block_num', 'desc').limit(1).executeTakeFirst();
    return row ? toFork(row) : null;
  }
}
