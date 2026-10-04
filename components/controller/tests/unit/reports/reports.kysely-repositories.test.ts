import { ReportDraftKyselyRepository } from '~/extensions/reports/infrastructure/repositories/report-draft.kysely-repository';
import { ReportSubmissionMarkKyselyRepository } from '~/extensions/reports/infrastructure/repositories/report-submission-mark.kysely-repository';
import { ReportRequisitesKyselyRepository } from '~/extensions/reports/infrastructure/repositories/report-requisites.kysely-repository';
import { BalanceCorrectionKyselyRepository } from '~/extensions/reports/infrastructure/repositories/balance-correction.kysely-repository';
import { GeneratedReportKyselyRepository } from '~/extensions/reports/infrastructure/repositories/generated-report.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

const make = (results: Parameters<typeof recordingKysely>[0] = []) => {
  const { db, queries } = recordingKysely(results);
  return { db: db as never, queries };
};

/** Хранилища отчётов: что уходит в базу. */
describe('хранилища отчётов на Kysely', () => {
  it('черновик годового отчёта ищется по пустому периоду, квартального — по номеру периода', async () => {
    const { db, queries } = make();
    const drafts = new ReportDraftKyselyRepository(db);

    await drafts.findOne('voskhod', 'ant', 'NDFL6' as never, 2026);
    await drafts.findOne('voskhod', 'ant', 'NDFL6' as never, 2026, 3);

    expect(queries[0].sql).toContain('"period" is null');
    expect(queries[1].sql).toContain('"period" = $5');
    expect(queries[1].parameters).toEqual(['voskhod', 'ant', 'NDFL6', 2026, 3]);
  });

  it('черновик удаляется только у своего владельца в своём кооперативе', async () => {
    const { db, queries } = make([{ affected: 0 }]);

    expect(await new ReportDraftKyselyRepository(db).delete('d1', 'voskhod', 'ant')).toBe(false);
    expect(queries[0].sql).toBe('delete from "report_drafts" where "id" = $1 and "coopname" = $2 and "owner_username" = $3');
  });

  it('отметка о сдаче: существующая правится, второй записи на тот же отчёт нет', async () => {
    const mark = { id: 'm1', coopname: 'voskhod', report_type: 'NDFL6', year: 2026, period: null, mark: 'SUBMITTED', created_by: 'ant' };
    const { db, queries } = make([{ rows: [mark] }, { rows: [{ ...mark, mark: 'ACCEPTED' }] }]);

    const saved = await new ReportSubmissionMarkKyselyRepository(db).set({
      coopname: 'voskhod',
      report_type: 'NDFL6' as never,
      year: 2026,
      mark: 'ACCEPTED' as never,
      created_by: 'ant',
    });

    expect(queries[0].sql).toContain('"period" is null');
    expect(queries[1].sql).toContain('update "report_submission_marks" set');
    expect(saved.mark).toBe('ACCEPTED');
  });

  it('реквизиты: не переданное поле не трогается, переданное пустым — стирается', async () => {
    const { db, queries } = make([{ rows: [{ coopname: 'voskhod' }] }]);

    await new ReportRequisitesKyselyRepository(db).upsert({ coopname: 'voskhod', updated_by: 'ant', okved: '94.99', okpo: null } as never);

    expect(queries[0].sql).toContain('on conflict ("coopname") do update set "okved" = $5, "okpo" = $6, "updated_by" = $7');
    expect(queries[0].sql).not.toContain('"oktmo"');
    expect(queries[0].parameters).toEqual(['voskhod', 'ant', '94.99', null, '94.99', null, 'ant']);
  });

  it('корректировки балансов сохраняются одним запросом', async () => {
    const { db, queries } = make();
    const row = { coopname: 'voskhod', year: 2026, balance_previous: 10, balance_pre_previous: '5.50', updated_by: 'ant' };

    await new BalanceCorrectionKyselyRepository(db).upsertMany([
      { ...row, account_display_id: '51' },
      { ...row, account_display_id: '86' },
    ] as never);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('on conflict ("coopname", "year", "account_display_id") do update set');
    expect(queries[0].parameters).toContain('10');
  });

  it('последний отчёт: без периода — любой, пустой период — только годовые', async () => {
    const { db, queries } = make();
    const reports = new GeneratedReportKyselyRepository(db);

    await reports.findLatest('voskhod', 'NDFL6' as never, 2026);
    await reports.findLatest('voskhod', 'NDFL6' as never, 2026, null);

    expect(queries[0].sql).not.toContain('"period"');
    expect(queries[1].sql).toContain('"period" is null');
    expect(queries[1].sql).toContain('order by "created_at" desc limit $4');
  });
});
