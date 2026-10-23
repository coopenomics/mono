import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { KYSELY, type Database } from '../kysely.tokens';

/**
 * Реестр шаблонов документов и переводов в базе узла.
 *
 * Хранит историю: у каждой записи свой номер блока, и чтение всегда идёт
 * «последняя версия не позже указанного блока». Так повторная сборка
 * подписанного документа получает тот текст, что действовал на момент подписи.
 * Без номера блока отдаётся текущее состояние.
 */
@Injectable()
export class DraftRegistryKyselyRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  /**
   * Сохраняет версию шаблона. Повторная доставка того же изменения — не ошибка:
   * пара «шаблон + блок» уникальна, и второй приход просто обновляет значение.
   */
  async saveTemplateVersion(data: { registry_id: string; block_num: number; value: any; present: boolean }): Promise<void> {
    const value = JSON.stringify(data.value);
    await this.db
      .insertInto('draft_templates')
      .values({ registry_id: data.registry_id, block_num: data.block_num, value, present: data.present })
      .onConflict((conflict) => conflict.columns(['registry_id', 'block_num']).doUpdateSet({ value, present: data.present }))
      .execute();
  }

  async saveTranslationVersion(data: {
    draft_id: string;
    lang: string;
    block_num: number;
    value: any;
    present: boolean;
  }): Promise<void> {
    const value = JSON.stringify(data.value);
    await this.db
      .insertInto('draft_translations')
      .values({ draft_id: data.draft_id, lang: data.lang, block_num: data.block_num, value, present: data.present })
      .onConflict((conflict) =>
        conflict.columns(['draft_id', 'lang', 'block_num']).doUpdateSet({ value, present: data.present })
      )
      .execute();
  }

  /** Шаблон, действовавший на указанном блоке (или текущий, если блок не задан). */
  async findTemplateAt(registryId: string | number, blockNum?: number): Promise<any | null> {
    let query = this.db.selectFrom('draft_templates').select('value').where('registry_id', '=', String(registryId));
    if (blockNum !== undefined) query = query.where('block_num', '<=', String(blockNum));
    const row = await query.orderBy('block_num', 'desc').limit(1).executeTakeFirst();
    return row?.value ?? null;
  }

  /**
   * Последний блок, на котором шаблон ещё имел указанную редакцию.
   *
   * Нужен фабрике утверждений: кооператив, не утвердивший новую редакцию,
   * читает текст утверждённой на этом блоке — с правками без смены номера, но
   * без смысловых изменений следующей редакции.
   */
  async findLastBlockOfVersion(registryId: string | number, version: number): Promise<number | null> {
    const row = await this.db
      .selectFrom('draft_templates')
      .select('block_num')
      .where('registry_id', '=', String(registryId))
      .where(sql<boolean>`(value->>'version')::bigint = ${version}`)
      .orderBy('block_num', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row ? Number(row.block_num) : null;
  }

  /** Перевод шаблона на указанный язык, действовавший на указанном блоке. */
  async findTranslationAt(draftId: string | number, lang: string, blockNum?: number): Promise<any | null> {
    let query = this.db
      .selectFrom('draft_translations')
      .select('value')
      .where('draft_id', '=', String(draftId))
      .where('lang', '=', lang);
    if (blockNum !== undefined) query = query.where('block_num', '<=', String(blockNum));
    const row = await query.orderBy('block_num', 'desc').limit(1).executeTakeFirst();
    return row?.value ?? null;
  }

  /**
   * Переводы шаблона на все языки, действовавшие на указанном блоке: языки
   * заранее не известны, поэтому берутся все версии и по одной свежей на язык.
   */
  async findTranslationsAt(draftId: string | number, blockNum?: number): Promise<any[]> {
    let query = this.db
      .selectFrom('draft_translations')
      .distinctOn('lang')
      .select('value')
      .where('draft_id', '=', String(draftId));
    if (blockNum !== undefined) query = query.where('block_num', '<=', String(blockNum));
    const rows = await query.orderBy('lang').orderBy('block_num', 'desc').execute();
    return rows.map((row) => row.value);
  }

  /**
   * Снимает версии, записанные в отрезанной ветке цепи.
   *
   * Форк отменяет блоки после точки расхождения, и версии шаблонов из них
   * описывают состояние, которого в цепи больше нет. Оставить их — значит
   * когда-нибудь собрать документ по несуществовавшей редакции.
   */
  async deleteAfterBlock(blockNum: number): Promise<number> {
    const templates = await this.db.deleteFrom('draft_templates').where('block_num', '>', String(blockNum)).executeTakeFirst();
    const translations = await this.db.deleteFrom('draft_translations').where('block_num', '>', String(blockNum)).executeTakeFirst();
    return Number(templates.numDeletedRows ?? 0) + Number(translations.numDeletedRows ?? 0);
  }

  /** Сколько версий шаблонов уже лежит в базе — нужно бэкфиллу, чтобы не дублировать работу. */
  async countTemplates(): Promise<number> {
    const row = await this.db
      .selectFrom('draft_templates')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}
