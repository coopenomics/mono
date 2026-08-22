import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { DraftTemplateEntity } from '../entities/draft-template.entity';
import { DraftTranslationEntity } from '../entities/draft-translation.entity';

/**
 * Реестр шаблонов документов и переводов в базе узла.
 *
 * Хранит историю: у каждой записи свой номер блока, и чтение всегда идёт
 * «последняя версия не позже указанного блока». Так повторная сборка
 * подписанного документа получает тот текст, что действовал на момент подписи.
 * Без номера блока отдаётся текущее состояние.
 */
@Injectable()
export class TypeOrmDraftRegistryRepository {
  constructor(
    @InjectRepository(DraftTemplateEntity)
    private readonly templates: Repository<DraftTemplateEntity>,
    @InjectRepository(DraftTranslationEntity)
    private readonly translations: Repository<DraftTranslationEntity>
  ) {}

  /**
   * Сохраняет версию шаблона. Повторная доставка того же изменения — не ошибка:
   * пара «шаблон + блок» уникальна, и второй приход просто обновляет значение.
   */
  async saveTemplateVersion(data: {
    registry_id: string;
    block_num: number;
    value: any;
    present: boolean;
  }): Promise<void> {
    await this.templates
      .createQueryBuilder()
      .insert()
      .values(data)
      .orUpdate(['value', 'present'], ['registry_id', 'block_num'])
      .execute();
  }

  async saveTranslationVersion(data: {
    draft_id: string;
    lang: string;
    block_num: number;
    value: any;
    present: boolean;
  }): Promise<void> {
    await this.translations
      .createQueryBuilder()
      .insert()
      .values(data)
      .orUpdate(['value', 'present'], ['draft_id', 'lang', 'block_num'])
      .execute();
  }

  /** Шаблон, действовавший на указанном блоке (или текущий, если блок не задан). */
  async findTemplateAt(registryId: string | number, blockNum?: number): Promise<any | null> {
    const qb = this.templates
      .createQueryBuilder('t')
      .where('t.registry_id = :registryId', { registryId: String(registryId) });

    if (blockNum !== undefined) qb.andWhere('t.block_num <= :blockNum', { blockNum });

    const row = await qb.orderBy('t.block_num', 'DESC').getOne();
    return row?.value ?? null;
  }

  /** Перевод шаблона на указанный язык, действовавший на указанном блоке. */
  async findTranslationAt(draftId: string | number, lang: string, blockNum?: number): Promise<any | null> {
    const qb = this.translations
      .createQueryBuilder('t')
      .where('t.draft_id = :draftId', { draftId: String(draftId) })
      .andWhere('t.lang = :lang', { lang });

    if (blockNum !== undefined) qb.andWhere('t.block_num <= :blockNum', { blockNum });

    const row = await qb.orderBy('t.block_num', 'DESC').getOne();
    return row?.value ?? null;
  }

  /**
   * Снимает версии, записанные в отрезанной ветке цепи.
   *
   * Форк отменяет блоки после точки расхождения, и версии шаблонов из них
   * описывают состояние, которого в цепи больше нет. Оставить их — значит
   * когда-нибудь собрать документ по несуществовавшей редакции.
   */
  async deleteAfterBlock(blockNum: number): Promise<number> {
    const t = await this.templates.delete({ block_num: MoreThan(blockNum) });
    const tr = await this.translations.delete({ block_num: MoreThan(blockNum) });
    return (t.affected ?? 0) + (tr.affected ?? 0);
  }

  /** Сколько версий шаблонов уже лежит в базе — нужно бэкфиллу, чтобы не дублировать работу. */
  async countTemplates(): Promise<number> {
    return this.templates.count();
  }
}
