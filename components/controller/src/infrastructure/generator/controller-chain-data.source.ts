import { Injectable } from '@nestjs/common';
import { DraftContract } from 'cooptypes';
import type { IActionQuery, IChainDataSource, ITableQuery } from '@coopenomics/factory';
import { DataSource } from 'typeorm';
import { TypeOrmDraftRegistryRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-draft-registry.repository';
import { BlockchainActionHistoryService } from '~/domain/parser/services/blockchain-action-history.service';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';

/**
 * Данные цепи для фабрики документов — из собственной базы узла.
 *
 * Раньше фабрика спрашивала их по HTTP у обозревателя старого парсера. Всё, что
 * ему было известно, узел и так складывает у себя: строки таблиц — в журнал
 * дельт, действия — в историю действий, шаблоны документов — в отдельный реестр
 * с версиями по блокам. Поэтому внешний сервис для этого больше не нужен.
 *
 * Запрос «на блок N» обслуживается везде, где он важен: документ, подписанный
 * ранее, обязан пересобираться данными того момента, иначе изменится его
 * содержимое при неизменном хэше.
 */
@Injectable()
export class ControllerChainDataSource implements IChainDataSource {
  constructor(
    private readonly dataSource: DataSource,
    private readonly draftRegistry: TypeOrmDraftRegistryRepository,
    private readonly actionHistory: BlockchainActionHistoryService,
    private readonly blockchainService: BlockchainService
  ) {}

  async getTableRows<T = any>(query: ITableQuery): Promise<T[]> {
    // Реестр шаблонов ведётся отдельно от журнала дельт: он общий для сети,
    // живёт вечно и читается на каждой сборке документа.
    if (query.code === DraftContract.contractName.production) {
      const fromRegistry = await this.readDraftRegistry<T>(query);
      if (fromRegistry) return fromRegistry;
    }

    return this.readFromDeltas<T>(query);
  }

  async getActions<T = any>(query: IActionQuery): Promise<T[]> {
    const { results } = await this.actionHistory.find(
      {
        account: query.account,
        ...(query.name ? { name: query.name } : {}),
        ...(query.data ? { data: mapToStrings(query.data) } : {}),
      },
      1,
      query.limit ?? 100
    );

    return results as unknown as T[];
  }

  async getCurrentBlock(): Promise<number> {
    const info = await this.blockchainService.getInfo();
    return Number(info.head_block_num);
  }

  /** Шаблон или перевод из реестра; null — таблица не из реестра. */
  private async readDraftRegistry<T>(query: ITableQuery): Promise<T[] | null> {
    if (query.table === DraftContract.Tables.Drafts.tableName) {
      const registryId = query.filter?.['registry_id'];
      if (registryId === undefined) return null;

      const template = await this.draftRegistry.findTemplateAt(String(registryId), query.block_num);
      return template ? ([template] as T[]) : ([] as T[]);
    }

    if (query.table === DraftContract.Tables.Translations.tableName) {
      const draftId = query.filter?.['draft_id'];
      if (draftId === undefined) return null;

      // Языки заранее не известны — берём все версии этого шаблона на нужный
      // блок и оставляем по одной свежей записи на язык.
      const rows = await this.dataSource.query(
        `SELECT DISTINCT ON (lang) value
           FROM draft_translations
          WHERE draft_id = $1::bigint
            AND ($2::bigint IS NULL OR block_num <= $2::bigint)
          ORDER BY lang, block_num DESC`,
        [String(draftId), query.block_num ?? null]
      );

      return rows.map((r: { value: unknown }) => r.value) as T[];
    }

    return null;
  }

  /**
   * Строки таблицы из журнала дельт: на каждый первичный ключ берётся
   * последнее изменение не позже нужного блока — так же, как это делал
   * обозреватель.
   */
  private async readFromDeltas<T>(query: ITableQuery): Promise<T[]> {
    const params: unknown[] = [query.code, query.scope, query.table, query.block_num ?? null];
    const conditions: string[] = [];

    Object.entries(query.filter ?? {}).forEach(([field, value]) => {
      const path = field.split('.');
      params.push(String(value));
      const placeholder = `$${params.length}`;
      conditions.push(
        path.length === 1
          ? `d.value ->> '${sanitizeKey(field)}' = ${placeholder}`
          : `d.value #>> '{${path.map(sanitizeKey).join(',')}}' = ${placeholder}`
      );
    });

    const rows = await this.dataSource.query(
      `SELECT DISTINCT ON (primary_key) value, present
         FROM blockchain_deltas d
        WHERE code = $1 AND scope = $2 AND "table" = $3
          AND ($4::bigint IS NULL OR block_num <= $4::bigint)
          ${conditions.length ? `AND ${conditions.join(' AND ')}` : ''}
        ORDER BY primary_key, block_num DESC`,
      params
    );

    // Строку, стёртую из он-чейн таблицы, отдавать нельзя: для потребителя её
    // не существует, а последняя дельта хранит её прежнее содержимое.
    return rows.filter((r: { present: boolean }) => r.present !== false).map((r: { value: unknown }) => r.value).slice(
      0,
      query.limit ?? undefined
    ) as T[];
  }
}

/** Значения условия сравниваются как текст — приводим заранее. */
function mapToStrings(source: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, String(v)]));
}

/**
 * Имя поля попадает в SQL текстом (параметром путь jsonb задать нельзя), поэтому
 * допускаем только безопасный набор символов — имена полей контрактов из них и
 * состоят.
 */
function sanitizeKey(key: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(key)) {
    throw new Error(`Недопустимое имя поля в условии выборки: ${key}`);
  }
  return key;
}
