import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import type { DeltaDomainInterface } from '~/domain/parser/interfaces/delta-domain.interface';
import type { HashLocation } from '~/domain/process-registry/config/process-hash-locator';
import type {
  ProcessDocumentActionsQuery,
  ProcessJournalPort,
} from '~/domain/process-registry/ports/process-journal.port';
import { KYSELY, type Database } from '../kysely.tokens';
import { rawQuery } from '@coopenomics/extension-kit';
import { toAction } from './blockchain-action.kysely-repository';
import { toDelta } from './blockchain-delta.kysely-repository';

/** Журнал цепи для реестра процессов (таблицы `blockchain_actions`, `blockchain_deltas`). */
@Injectable()
export class ProcessJournalKyselyRepository implements ProcessJournalPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findActionsByProcess(hash: string, coopname: string): Promise<ActionDomainInterface[]> {
    const rows = await this.db
      .selectFrom('blockchain_actions')
      .selectAll()
      .where(sql<boolean>`LOWER(data ->> 'process_hash') = ${hash}`)
      .where(sql<boolean>`data ->> 'coopname' = ${coopname}`)
      .orderBy('block_num', 'asc')
      .orderBy('global_sequence', 'asc')
      .execute();
    return rows.map(toAction);
  }

  /**
   * Кооператив у одних таблиц записан в области, у других — в самом значении
   * (контракты с единой областью): подходят оба варианта.
   */
  async findEntityDeltas(location: HashLocation, hash: string, coopname: string): Promise<DeltaDomainInterface[]> {
    const rows = await this.db
      .selectFrom('blockchain_deltas')
      .selectAll()
      .where('code', '=', location.code)
      .where('table', '=', location.table)
      .where(sql<boolean>`LOWER(value ->> ${location.field}) = ${hash}`)
      .where((eb) => eb.or([eb('scope', '=', coopname), sql<boolean>`value ->> 'coopname' = ${coopname}`]))
      .orderBy('block_num', 'asc')
      .execute();
    return rows.map(toDelta);
  }

  /**
   * Хэш сверяется без учёта регистра: контракты пишут его в данных заглавными.
   * Окно блоков ограничивает перебор индексом по номеру блока.
   */
  async findDocumentActions(query: ProcessDocumentActionsQuery): Promise<ActionDomainInterface[]> {
    const rows = await this.db
      .selectFrom('blockchain_actions')
      .selectAll()
      .where('block_num', '>=', String(query.fromBlock))
      .where('block_num', '<=', String(query.toBlock))
      .where('account', '<>', query.excludeAccount)
      .where(sql<boolean>`data ->> 'coopname' = ${query.coopname}`)
      .where(sql<boolean>`data::text ILIKE ${`%${query.hash}%`}`)
      .orderBy('block_num', 'asc')
      .orderBy('global_sequence', 'asc')
      .execute();
    return rows.map(toAction);
  }

  async query<TRow = Record<string, unknown>>(text: string, parameters: readonly unknown[]): Promise<TRow[]> {
    return rawQuery<TRow>(this.db, text, parameters);
  }
}
