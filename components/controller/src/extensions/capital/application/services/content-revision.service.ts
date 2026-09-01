import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ContentRevisionTypeormEntity } from '../../infrastructure/entities/content-revision.typeorm-entity';
import { ContentEntityType } from '../../domain/enums/content-entity-type.enum';
import { ContentRevisionOrigin } from '../../domain/enums/content-revision-origin.enum';
import { ContentConflictError } from '../../domain/errors/content-conflict.error';
import {
  mergeContent,
  normalizeDescription,
  type ContentSnapshot,
} from '../../domain/utils/content-merge.util';

/** Таблица и колонка-ключ каждой сущности с историей редакций. */
const ENTITY_TABLES: Record<ContentEntityType, { table: string; hashColumn: string; hasFormat: boolean }> = {
  [ContentEntityType.PROJECT]: { table: 'capital_projects', hashColumn: 'project_hash', hasFormat: false },
  [ContentEntityType.ISSUE]: { table: 'capital_issues', hashColumn: 'issue_hash', hasFormat: false },
  [ContentEntityType.STORY]: { table: 'capital_stories', hashColumn: 'story_hash', hasFormat: true },
};

export const SYSTEM_AUTHOR = 'system';

export interface PrepareContentWriteInput {
  entity_type: ContentEntityType;
  entity_hash: string;
  author: string;
  origin: ContentRevisionOrigin;
  /** Редакция, с которой автор начал правку. undefined — клиент без поддержки редакций (запись без проверки). */
  base_rev?: number | null;
  /** Что прислал автор. undefined у поля — «не трогал». */
  incoming: { title?: string; description?: string | null };
  restored_from_rev?: number | null;
}

export interface PreparedContentWrite {
  title: string;
  description: string;
  content_rev: number;
  /** Текст получен слиянием с параллельной правкой — клиент обязан заменить своё содержимое. */
  merged: boolean;
  /** false — присланное совпало с текущим, редакция не создавалась. */
  changed: boolean;
  /** Редакция до записи (для отката при провале внешней транзакции). */
  previous_rev: number;
}

interface LockedRow {
  title: string;
  description: string;
  content_rev: number;
  content_format: string | null;
}

export function contentHash(snapshot: ContentSnapshot): string {
  return createHash('sha256').update(`${snapshot.title}\n${snapshot.description}`).digest('hex');
}

/**
 * История редакций и серверное трёхстороннее слияние для проектов, задач и артефактов.
 *
 * Единственная точка, которая меняет `content_rev`: строка сущности блокируется (`FOR UPDATE`),
 * свежий текст сливается с присланным относительно базовой редакции, слитый текст и снимок
 * пишутся в одной транзакции. Любой параллельный писатель ждёт блокировку и сливается уже
 * поверх результата — перезаписать чужую правку невозможно.
 */
@Injectable()
export class ContentRevisionService {
  private readonly logger = new Logger(ContentRevisionService.name);

  constructor(
    @InjectRepository(ContentRevisionTypeormEntity)
    private readonly revisionRepository: Repository<ContentRevisionTypeormEntity>
  ) {}

  /** Готовит запись содержимого: блокировка, ленивый первичный снимок, слияние, новая редакция. */
  async prepareWrite(input: PrepareContentWriteInput): Promise<PreparedContentWrite> {
    return this.revisionRepository.manager.transaction(async (em) => {
      const current = await this.lockRow(em, input.entity_type, input.entity_hash);
      const currentRev = await this.ensureSeeded(em, input.entity_type, input.entity_hash, current);

      const theirs: ContentSnapshot = { title: current.title, description: current.description };
      const ours: ContentSnapshot = {
        title: input.incoming.title ?? theirs.title,
        description:
          input.incoming.description === undefined ? theirs.description : normalizeDescription(input.incoming.description),
      };

      let result = ours;
      let merged = false;
      // base_rev = 0: клиент видел сущность до первого снимка; этот текст и стал rev 1 при посеве.
      let baseRev = input.base_rev ?? undefined;
      if (baseRev === 0) {
        baseRev = 1;
      }
      if (baseRev !== undefined && baseRev !== null && baseRev !== currentRev) {
        if (baseRev > currentRev) {
          throw new Error(
            `Редакция ${baseRev} клиента новее серверной ${currentRev} для ${input.entity_type} ${input.entity_hash}: обновите данные`
          );
        }
        const baseRow = await em.findOne(ContentRevisionTypeormEntity, {
          where: { entity_type: input.entity_type, entity_hash: input.entity_hash, rev: baseRev },
        });
        const base: ContentSnapshot | null = baseRow
          ? { title: baseRow.title, description: normalizeDescription(baseRow.description) }
          : null;
        if (ours.title === theirs.title && ours.description === theirs.description) {
          // Автор прислал то же, что уже на сервере, — ни конфликта, ни редакции.
          result = theirs;
        } else if (!base) {
          throw new ContentConflictError({
            entity_type: input.entity_type,
            entity_hash: input.entity_hash,
            base_rev: baseRev,
            current_rev: currentRev,
            title_conflict: ours.title !== theirs.title,
            description_conflict: ours.description !== theirs.description,
            ours,
            theirs,
            base: null,
            marked: '',
          });
        } else {
          const outcome = mergeContent(ours, base, theirs, current.content_format);
          if (outcome.status === 'conflict') {
            throw new ContentConflictError({
              entity_type: input.entity_type,
              entity_hash: input.entity_hash,
              base_rev: baseRev,
              current_rev: currentRev,
              title_conflict: outcome.title_conflict,
              description_conflict: outcome.description_conflict,
              ours,
              theirs,
              base,
              marked: outcome.hunks.marked,
            });
          }
          result = outcome.result;
          merged = outcome.merged;
        }
      }

      if (result.title === theirs.title && result.description === theirs.description) {
        return {
          title: theirs.title,
          description: theirs.description,
          content_rev: currentRev,
          merged,
          changed: false,
          previous_rev: currentRev,
        };
      }

      const nextRev = currentRev + 1;
      await this.writeRow(em, input.entity_type, input.entity_hash, result, nextRev);
      await em.insert(ContentRevisionTypeormEntity, {
        entity_type: input.entity_type,
        entity_hash: input.entity_hash,
        rev: nextRev,
        base_rev: baseRev ?? currentRev,
        title: result.title,
        description: result.description,
        content_format: current.content_format,
        content_hash: contentHash(result),
        author: input.author || SYSTEM_AUTHOR,
        origin: input.origin,
        restored_from_rev: input.restored_from_rev ?? null,
        merged,
      });

      return {
        title: result.title,
        description: result.description,
        content_rev: nextRev,
        merged,
        changed: true,
        previous_rev: currentRev,
      };
    });
  }

  /**
   * Откат подготовленной записи, если внешняя транзакция (блокчейн) провалилась:
   * снимок `rev` удаляется, строка возвращается к `rev - 1`.
   */
  async rollbackWrite(entityType: ContentEntityType, entityHash: string, rev: number): Promise<void> {
    await this.revisionRepository.manager.transaction(async (em) => {
      const current = await this.lockRow(em, entityType, entityHash);
      if (current.content_rev !== rev) {
        this.logger.warn(
          `Откат редакции ${rev} для ${entityType} ${entityHash} пропущен: на строке уже ${current.content_rev}`
        );
        return;
      }
      const prev = await em.findOne(ContentRevisionTypeormEntity, {
        where: { entity_type: entityType, entity_hash: entityHash, rev: rev - 1 },
      });
      if (!prev) return;
      await this.writeRow(
        em,
        entityType,
        entityHash,
        { title: prev.title, description: normalizeDescription(prev.description) },
        rev - 1
      );
      await em.delete(ContentRevisionTypeormEntity, { entity_type: entityType, entity_hash: entityHash, rev });
    });
  }

  /**
   * Фиксирует редакцию, если содержимое строки изменилось мимо сервиса (синхронизация из цепи и т. п.).
   * Сравнивает строку с последним снимком; при расхождении пишет новую редакцию указанного происхождения.
   */
  async recordExternalIfChanged(
    entityType: ContentEntityType,
    entityHash: string,
    origin: ContentRevisionOrigin,
    author: string = SYSTEM_AUTHOR
  ): Promise<void> {
    await this.revisionRepository.manager.transaction(async (em) => {
      const current = await this.lockRow(em, entityType, entityHash);
      const currentRev = await this.ensureSeeded(em, entityType, entityHash, current);
      const last = await em.findOne(ContentRevisionTypeormEntity, {
        where: { entity_type: entityType, entity_hash: entityHash, rev: currentRev },
      });
      const snapshot: ContentSnapshot = { title: current.title, description: current.description };
      if (last && last.title === snapshot.title && normalizeDescription(last.description) === snapshot.description) {
        return;
      }
      const nextRev = currentRev + 1;
      await em.query(
        `UPDATE ${ENTITY_TABLES[entityType].table} SET content_rev = $1 WHERE ${ENTITY_TABLES[entityType].hashColumn} = $2`,
        [nextRev, entityHash]
      );
      await em.insert(ContentRevisionTypeormEntity, {
        entity_type: entityType,
        entity_hash: entityHash,
        rev: nextRev,
        base_rev: currentRev,
        title: snapshot.title,
        description: snapshot.description,
        content_format: current.content_format,
        content_hash: contentHash(snapshot),
        author,
        origin,
        merged: false,
      });
    });
  }

  /** Первичный снимок для только что созданной сущности (rev = 1). */
  async seedInitial(
    entityType: ContentEntityType,
    entityHash: string,
    author: string,
    origin: ContentRevisionOrigin
  ): Promise<void> {
    await this.revisionRepository.manager.transaction(async (em) => {
      const current = await this.lockRow(em, entityType, entityHash);
      await this.ensureSeeded(em, entityType, entityHash, current, author, origin);
    });
  }

  async listRevisions(entityType: ContentEntityType, entityHash: string): Promise<ContentRevisionTypeormEntity[]> {
    await this.ensureSeededStandalone(entityType, entityHash);
    return this.revisionRepository.find({
      where: { entity_type: entityType, entity_hash: entityHash },
      order: { rev: 'DESC' },
    });
  }

  async getRevision(
    entityType: ContentEntityType,
    entityHash: string,
    rev: number
  ): Promise<ContentRevisionTypeormEntity | null> {
    await this.ensureSeededStandalone(entityType, entityHash);
    return this.revisionRepository.findOne({ where: { entity_type: entityType, entity_hash: entityHash, rev } });
  }

  async getCurrentRev(entityType: ContentEntityType, entityHash: string): Promise<number> {
    const { table, hashColumn } = ENTITY_TABLES[entityType];
    const rows: Array<{ content_rev: number }> = await this.revisionRepository.manager.query(
      `SELECT content_rev FROM ${table} WHERE ${hashColumn} = $1`,
      [entityHash]
    );
    return rows[0]?.content_rev ?? 0;
  }

  /** Ленивый первичный снимок без внешней транзакции — чтобы существующие сущности сразу имели историю. */
  private async ensureSeededStandalone(entityType: ContentEntityType, entityHash: string): Promise<void> {
    const rev = await this.getCurrentRev(entityType, entityHash);
    if (rev > 0) return;
    try {
      await this.seedInitial(entityType, entityHash, SYSTEM_AUTHOR, ContentRevisionOrigin.BACKFILL);
    } catch (e: any) {
      this.logger.warn(`Первичный снимок ${entityType} ${entityHash} не создан: ${e?.message ?? e}`);
    }
  }

  private async lockRow(em: EntityManager, entityType: ContentEntityType, entityHash: string): Promise<LockedRow> {
    const { table, hashColumn, hasFormat } = ENTITY_TABLES[entityType];
    const formatCol = hasFormat ? 'content_format' : 'NULL AS content_format';
    const rows: Array<{ title: string; description: string | null; content_rev: number; content_format: string | null }> =
      await em.query(
        `SELECT title, description, content_rev, ${formatCol} FROM ${table} WHERE ${hashColumn} = $1 FOR UPDATE`,
        [entityHash]
      );
    const row = rows[0];
    if (!row) {
      throw new Error(`Сущность ${entityType} ${entityHash} не найдена`);
    }
    return {
      title: row.title ?? '',
      description: normalizeDescription(row.description),
      content_rev: Number(row.content_rev ?? 0),
      content_format: row.content_format ?? null,
    };
  }

  /** Если редакций ещё нет (content_rev = 0) — записывает rev 1 из текущего текста. Возвращает актуальный rev. */
  private async ensureSeeded(
    em: EntityManager,
    entityType: ContentEntityType,
    entityHash: string,
    current: LockedRow,
    author: string = SYSTEM_AUTHOR,
    origin: ContentRevisionOrigin = ContentRevisionOrigin.BACKFILL
  ): Promise<number> {
    if (current.content_rev > 0) return current.content_rev;
    const { table, hashColumn } = ENTITY_TABLES[entityType];
    const snapshot: ContentSnapshot = { title: current.title, description: current.description };
    await em.query(`UPDATE ${table} SET content_rev = 1 WHERE ${hashColumn} = $1`, [entityHash]);
    await em.insert(ContentRevisionTypeormEntity, {
      entity_type: entityType,
      entity_hash: entityHash,
      rev: 1,
      base_rev: null,
      title: snapshot.title,
      description: snapshot.description,
      content_format: current.content_format,
      content_hash: contentHash(snapshot),
      author,
      origin,
      merged: false,
    });
    current.content_rev = 1;
    return 1;
  }

  private async writeRow(
    em: EntityManager,
    entityType: ContentEntityType,
    entityHash: string,
    content: ContentSnapshot,
    rev: number
  ): Promise<void> {
    const { table, hashColumn } = ENTITY_TABLES[entityType];
    await em.query(
      `UPDATE ${table} SET title = $1, description = $2, content_rev = $3 WHERE ${hashColumn} = $4`,
      [content.title, content.description, rev, entityHash]
    );
  }
}
