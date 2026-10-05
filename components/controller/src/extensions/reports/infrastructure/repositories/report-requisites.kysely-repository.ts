import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import type {
  ReportRequisitesRecord,
  ReportRequisitesRepository,
  UpsertReportRequisitesInput,
} from '../../domain/repositories/report-requisites.repository';
import type { DB } from '../database/reports.database.types';

const OPTIONAL = [
  'okved',
  'okfs',
  'okopf',
  'oktmo',
  'okpo',
  'sfr_reg_number',
  'pfr_reg_number',
  'chairman_position',
  'signer_snils',
  'signer_inn',
  'signer_rep_doc',
  'signer_type',
  'phone_override',
  'address_override',
] as const;

/** Реквизиты кооператива для отчётности (таблица `report_requisites`). */
@Injectable()
export class ReportRequisitesKyselyRepository implements ReportRequisitesRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async getByCoopname(coopname: string): Promise<ReportRequisitesRecord | null> {
    const row = await this.db.selectFrom('report_requisites').selectAll().where('coopname', '=', coopname).executeTakeFirst();
    return (row as ReportRequisitesRecord | undefined) ?? null;
  }

  /**
   * Одним запросом, без гонки двух параллельных правок. Не переданное поле
   * означает «не трогать»: правятся только явно заданные.
   */
  async upsert(input: UpsertReportRequisitesInput): Promise<ReportRequisitesRecord> {
    const given = Object.fromEntries(OPTIONAL.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
    const row = await this.db
      .insertInto('report_requisites')
      .values({ coopname: input.coopname, updated_by: input.updated_by, ...given })
      .onConflict((conflict) =>
        conflict.column('coopname').doUpdateSet({ ...given, updated_by: input.updated_by, updated_at: sql`now()` })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as ReportRequisitesRecord;
  }
}
