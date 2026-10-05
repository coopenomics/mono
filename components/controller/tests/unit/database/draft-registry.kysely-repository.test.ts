import { DraftRegistryKyselyRepository } from '~/infrastructure/database/kysely/repositories/draft-registry.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

/**
 * Реестр шаблонов хранит историю по блокам: чтение — «последняя версия не позже
 * блока», иначе подписанный документ пересоберётся сегодняшним текстом.
 */
describe('DraftRegistryKyselyRepository', () => {
  it('переводы на блок: по одной свежей записи на язык', async () => {
    const { db, queries } = recordingKysely();

    await new DraftRegistryKyselyRepository(db).findTranslationsAt('100', 500);

    expect(queries[0].sql).toContain('distinct on ("lang")');
    expect(queries[0].sql).toContain('"block_num" <= $2');
    expect(queries[0].sql).toContain('order by "lang", "block_num" desc');
    expect(queries[0].parameters).toEqual(['100', '500']);
  });

  it('без блока читается текущее состояние — ограничения по блоку нет', async () => {
    const { db, queries } = recordingKysely();
    const repository = new DraftRegistryKyselyRepository(db);

    await repository.findTranslationsAt('100');
    await repository.findTemplateAt('100');

    expect(queries.map((query) => query.sql).join(' ')).not.toContain('"block_num" <=');
    expect(queries[1].sql).toContain('order by "block_num" desc');
  });

  it('шаблон на блок: последняя версия не позже блока', async () => {
    const { db, queries } = recordingKysely();

    await new DraftRegistryKyselyRepository(db).findTemplateAt(100, 500);

    expect(queries[0].sql).toContain('"registry_id" = $1 and "block_num" <= $2');
    expect(queries[0].parameters).toEqual(['100', '500', 1]);
  });

  it('форк снимает версии шаблонов и переводов после блока', async () => {
    const { db, queries } = recordingKysely();

    await new DraftRegistryKyselyRepository(db).deleteAfterBlock(4808);

    expect(queries.map((query) => query.sql)).toEqual([
      'delete from "draft_templates" where "block_num" > $1',
      'delete from "draft_translations" where "block_num" > $1',
    ]);
  });
});
