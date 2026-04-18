import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { DeltaEntity } from '~/infrastructure/database/typeorm/entities/delta.entity';
import { ActionEntity } from '~/infrastructure/database/typeorm/entities/action.entity';
import { DocumentAggregator } from '~/domain/document/aggregators/document.aggregator';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  PROCESS_HASH_LOCATOR,
  KNOWN_PROCESS_TYPES,
  type HashLocation,
} from '../config/process-hash-locator';
import { DOCUMENT_FIELDS, looksLikeSignedDocument } from '../config/document-field-detector';
import type {
  ProcessView,
  ProcessActionView,
  ProcessDeltaView,
  ProcessDocumentView,
  ProcessesFilter,
  ProcessSummary,
} from '../interfaces/process-view.interface';
import {
  PaginationInputDTO,
  PaginationResult,
} from '~/application/common/dto/pagination.dto';

const LEDGER2_CODE = 'ledger2';
const LEDGER2_JOURNALS = ['wjournal', 'journal'] as const;
const HARD_LIMIT = 200;
const CACHE_TTL_SECONDS = 60;

type RedisClient = {
  subscriber: Redis;
  publisher: Redis;
  streamManager: Redis;
  streamReader: Redis;
};

/**
 * Read-only агрегатор процессов ledger2. См. architecture.md §3.4, §4.6.
 *
 * Алгоритм двухфазный:
 *   - Phase A — anchor scan по _ledger2/wjournal+journal по process_hash.
 *   - Phase B — fan-out scan по PROCESS_HASH_LOCATOR + blockchain_actions.
 *   - Phase C — выделение документов через DocumentFieldDetector + DocumentAggregator.
 *
 * Кеш Redis TTL 60 сек (событийная инвалидация — v2).
 */
@Injectable()
export class ProcessRegistryService {
  constructor(
    @InjectRepository(DeltaEntity)
    private readonly deltaRepository: Repository<DeltaEntity>,
    @InjectRepository(ActionEntity)
    private readonly actionRepository: Repository<ActionEntity>,
    private readonly documentAggregator: DocumentAggregator,
    @Inject(REDIS_PROVIDER)
    private readonly redisClient: RedisClient,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ProcessRegistryService.name);
  }

  /**
   * Получить полную картину процесса по хэшу.
   *
   * @throws NotFoundException если процесс не найден в wjournal/journal
   * @throws BadRequestException при превышении HARD_LIMIT или неизвестном process_type
   */
  async getProcess(processHash: string, coopname: string): Promise<ProcessView> {
    const normHash = this.normalizeHash(processHash);

    const cacheKey = `process::${coopname}::${normHash}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    // ---------- Phase A: anchor scan в ledger2-журналах ----------
    // ledger2 хранит coopname в scope (не в value.jsonb), поэтому фильтр —
    // по scope вместо value->>'coopname'. checksum256 в блокчейн-дельтах
    // хранится uppercase, поэтому сравниваем через LOWER() обе стороны.
    const anchors = await this.deltaRepository
      .createQueryBuilder('d')
      .where('d.code = :code', { code: LEDGER2_CODE })
      .andWhere('d.table IN (:...tables)', { tables: LEDGER2_JOURNALS })
      .andWhere("LOWER(d.value ->> 'process_hash') = :hash", { hash: normHash })
      .andWhere('d.scope = :coop', { coop: coopname })
      .orderBy('d.block_num', 'ASC')
      .getMany();

    if (anchors.length === 0) {
      throw new NotFoundException(`Процесс с хэшем ${normHash} не найден в ledger2`);
    }

    const firstAnchorValue = (anchors[0].value ?? {}) as Record<string, unknown>;
    const processType = String(firstAnchorValue.process_type ?? '').trim();
    if (!processType) {
      throw new BadRequestException(
        `Якорная запись ledger2 без process_type (hash=${normHash}); репарсинг дельт или схема wjournal устарели`
      );
    }
    if (!KNOWN_PROCESS_TYPES.has(processType)) {
      this.logger.error(
        `ProcessRegistry: неизвестный process_type='${processType}' для hash=${normHash}. Обновите PROCESS_HASH_LOCATOR.`
      );
      throw new BadRequestException(
        `Неизвестный process_type: ${processType}. PROCESS_HASH_LOCATOR требует обновления.`
      );
    }

    // ---------- Phase B: fan-out scan по сущностным таблицам + actions ----------
    const locations: HashLocation[] = PROCESS_HASH_LOCATOR[processType] ?? [];
    const entityDeltas = await this.scanEntityDeltas(locations, normHash, coopname);

    // actions — ищем во всех транзакциях, где упоминается process_hash.
    // Фильтруем по account IN ledger2 + всем кодам, фигурирующим в локаторе.
    const relevantAccounts = new Set<string>([LEDGER2_CODE, ...locations.map((l) => l.code)]);
    const actions = await this.scanActions(normHash, coopname, relevantAccounts);

    // ---------- сборка delta_history ----------
    const allDeltas = [...anchors, ...entityDeltas]
      .map((d) => this.toDeltaView(d))
      .sort(this.compareByBlock);

    this.enforceLimit(allDeltas.length, 'delta_history', normHash);
    this.enforceLimit(actions.length, 'actions', normHash);

    // ---------- Phase C: документы ----------
    const documents = await this.extractDocuments(allDeltas);

    const view: ProcessView = {
      process_type: processType,
      process_hash: normHash,
      coopname,
      first_seen_at: allDeltas[0]?.created_at ?? anchors[0].created_at,
      last_seen_at:
        allDeltas[allDeltas.length - 1]?.created_at ?? anchors[anchors.length - 1].created_at,
      actions: actions.map(this.toActionView).sort(this.compareByBlock),
      delta_history: allDeltas,
      documents,
    };

    await this.cacheSet(cacheKey, view);
    return view;
  }

  /**
   * Листинг процессов с пагинацией.
   * SQL: SELECT DISTINCT ON (process_hash) по wjournal с coopname-фильтром,
   * + count-агрегаты для actions/deltas/documents по каждому process_hash.
   */
  async listProcesses(
    filter: ProcessesFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<ProcessSummary>> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.max(1, Math.min(100, pagination.limit ?? 10));
    const offset = (page - 1) * limit;

    // Coopname-scoping идёт по d.scope, т.к. ledger2 wjournal/journal хранят
    // coopname как scope, а не в value.jsonb.
    const countRow = await this.deltaRepository.manager.query(
      `SELECT COUNT(DISTINCT d.value ->> 'process_hash') AS cnt
       FROM blockchain_deltas d
       WHERE d.code = $1
         AND d.table = 'wjournal'
         AND d.scope = $2
         AND (d.value ->> 'process_hash') IS NOT NULL
         ${filter.processType ? "AND d.value ->> 'process_type' = $3" : ''}
         ${filter.username ? `AND d.value ->> 'username' = $${filter.processType ? 4 : 3}` : ''}
         ${filter.fromBlock ? `AND d.block_num >= $${this.nextParamIdx(filter, 'from')}` : ''}
         ${filter.toBlock ? `AND d.block_num <= $${this.nextParamIdx(filter, 'to')}` : ''}
      `,
      this.buildParams(filter)
    );
    const totalCount = parseInt(countRow[0]?.cnt ?? '0', 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    // Выборка страницы. processHash нормализуется к lowercase для единообразия
    // с getProcess (ончейн хранит uppercase, а наружу отдаём lowercase hex).
    const rows = await this.deltaRepository.manager.query(
      `SELECT
         d.value ->> 'process_type'           AS "processType",
         LOWER(d.value ->> 'process_hash')    AS "processHash",
         d.scope                              AS "coopname",
         MIN(d.value ->> 'username') AS "username",
         MIN(d.created_at) AS "firstSeenAt",
         MAX(d.created_at) AS "lastSeenAt"
       FROM blockchain_deltas d
       WHERE d.code = $1
         AND d.table = 'wjournal'
         AND d.scope = $2
         AND (d.value ->> 'process_hash') IS NOT NULL
         ${filter.processType ? "AND d.value ->> 'process_type' = $3" : ''}
         ${filter.username ? `AND d.value ->> 'username' = $${filter.processType ? 4 : 3}` : ''}
         ${filter.fromBlock ? `AND d.block_num >= $${this.nextParamIdx(filter, 'from')}` : ''}
         ${filter.toBlock ? `AND d.block_num <= $${this.nextParamIdx(filter, 'to')}` : ''}
       GROUP BY d.value ->> 'process_type',
                LOWER(d.value ->> 'process_hash'),
                d.scope
       ORDER BY MAX(d.created_at) DESC
       LIMIT ${limit} OFFSET ${offset}
      `,
      this.buildParams(filter)
    );

    const items: ProcessSummary[] = await Promise.all(
      (rows as any[]).map(async (r) => {
        const actionCount = await this.countActionsByHash(r.processHash, r.coopname);
        const deltaCount = await this.countDeltasByHash(r.processHash, r.coopname);
        const documentCount = await this.countDocumentsByHash(r.processHash, r.coopname);
        return {
          processType: r.processType,
          processHash: r.processHash,
          coopname: r.coopname,
          username: r.username ?? null,
          firstSeenAt: new Date(r.firstSeenAt),
          lastSeenAt: new Date(r.lastSeenAt),
          actionCount,
          deltaCount,
          documentCount,
        };
      })
    );

    return { items, totalCount, totalPages, currentPage: page };
  }

  // =====================================================================
  // private helpers
  // =====================================================================

  private normalizeHash(hash: string): string {
    const trimmed = (hash ?? '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(trimmed)) {
      throw new BadRequestException(`process_hash должен быть hex-64 (получено: "${hash}")`);
    }
    return trimmed;
  }

  private enforceLimit(count: number, collection: string, hash: string) {
    if (count > HARD_LIMIT) {
      throw new BadRequestException(
        `Превышен лимит ${HARD_LIMIT} в ${collection} для процесса ${hash} (фактически: ${count})`
      );
    }
  }

  private async scanEntityDeltas(
    locations: HashLocation[],
    hash: string,
    coopname: string
  ): Promise<DeltaEntity[]> {
    if (locations.length === 0) return [];
    const all: DeltaEntity[] = [];
    for (const loc of locations) {
      // Coopname-скоупинг: часть таблиц хранит coopname в scope (ledger2,
      // большинство кооп-scope таблиц), часть — в value.jsonb (singleton-scope
      // контракты типа registrator). Поддерживаем оба варианта.
      const rows = await this.deltaRepository
        .createQueryBuilder('d')
        .where('d.code = :code', { code: loc.code })
        .andWhere('d.table = :table', { table: loc.table })
        .andWhere(`LOWER(d.value ->> :field) = :hash`, { field: loc.field, hash })
        .andWhere("(d.scope = :coop OR d.value ->> 'coopname' = :coop)", { coop: coopname })
        .orderBy('d.block_num', 'ASC')
        .getMany();
      all.push(...rows);
    }
    return all;
  }

  private async scanActions(
    hash: string,
    coopname: string,
    accounts: Set<string>
  ): Promise<ActionEntity[]> {
    const accountList = Array.from(accounts);
    return this.actionRepository
      .createQueryBuilder('a')
      .where('a.account IN (:...accounts)', { accounts: accountList })
      .andWhere("(a.data::text ILIKE :hashPattern)", { hashPattern: `%${hash}%` })
      .andWhere("(a.data::text ILIKE :coopPattern)", { coopPattern: `%${coopname}%` })
      .orderBy('a.block_num', 'ASC')
      .addOrderBy('a.global_sequence', 'ASC')
      .getMany();
  }

  private async extractDocuments(deltas: ProcessDeltaView[]): Promise<ProcessDocumentView[]> {
    const documents: ProcessDocumentView[] = [];
    for (const delta of deltas) {
      const v = delta.value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') continue;

      const candidates = this.findDocumentFields(delta.code, delta.table, v);
      for (const { field, value } of candidates) {
        try {
          const signed = value as any;
          const aggregate = await this.documentAggregator.buildDocumentAggregate(signed);
          if (!aggregate) continue;
          documents.push({
            hash: aggregate.hash || signed.hash || signed.doc_hash || '',
            source: {
              code: delta.code,
              table: delta.table,
              field,
              primary_key: delta.primary_key,
            },
            document: aggregate.document,
            raw: aggregate.rawDocument ?? null,
          });
        } catch (e: any) {
          this.logger.warn(
            `ProcessRegistry: buildDocumentAggregate упал для ${delta.code}/${delta.table}.${field}: ${e?.message}`
          );
        }
      }
    }
    return documents;
  }

  private findDocumentFields(
    code: string,
    table: string,
    value: Record<string, unknown>
  ): Array<{ field: string; value: unknown }> {
    const results: Array<{ field: string; value: unknown }> = [];
    const registered = DOCUMENT_FIELDS.filter((d) => d.code === code && d.table === table);
    const registeredFields = new Set(registered.map((r) => r.field));

    for (const field of registeredFields) {
      if (value[field] && looksLikeSignedDocument(value[field])) {
        results.push({ field, value: value[field] });
      }
    }

    // Fallback-эвристика: проверяем любые поля, где лежит похожий на документ объект.
    for (const [field, fieldValue] of Object.entries(value)) {
      if (registeredFields.has(field)) continue;
      if (looksLikeSignedDocument(fieldValue)) {
        results.push({ field, value: fieldValue });
      }
    }
    return results;
  }

  private toDeltaView = (d: DeltaEntity): ProcessDeltaView => ({
    id: d.id,
    code: d.code,
    scope: d.scope,
    table: d.table,
    primary_key: d.primary_key,
    present: d.present,
    value: d.value,
    block_num: Number(d.block_num),
    created_at: d.created_at,
  });

  private toActionView = (a: ActionEntity): ProcessActionView => ({
    id: a.id,
    account: a.account,
    name: a.name,
    data: a.data,
    block_num: Number(a.block_num),
    block_id: a.block_id,
    global_sequence: a.global_sequence,
    transaction_id: a.transaction_id,
    created_at: a.created_at,
  });

  private compareByBlock = (
    a: { block_num: number; created_at: Date },
    b: { block_num: number; created_at: Date }
  ): number => {
    if (a.block_num !== b.block_num) return a.block_num - b.block_num;
    return a.created_at.getTime() - b.created_at.getTime();
  };

  private nextParamIdx(filter: ProcessesFilter, which: 'from' | 'to'): number {
    let idx = 3; // $1=code, $2=coopname
    if (filter.processType) idx += 1;
    if (filter.username) idx += 1;
    if (which === 'to' && filter.fromBlock) idx += 1;
    return idx;
  }

  private buildParams(filter: ProcessesFilter): any[] {
    const params: any[] = [LEDGER2_CODE, filter.coopname];
    if (filter.processType) params.push(filter.processType);
    if (filter.username) params.push(filter.username);
    if (filter.fromBlock) params.push(filter.fromBlock);
    if (filter.toBlock) params.push(filter.toBlock);
    return params;
  }

  private async countActionsByHash(hash: string, coopname: string): Promise<number> {
    // ILIKE уже case-insensitive, так что проверим по lowercase-подстроке.
    const row = await this.actionRepository.manager.query(
      `SELECT COUNT(*) AS cnt FROM blockchain_actions a
       WHERE (a.data::text ILIKE $1) AND (a.data::text ILIKE $2)`,
      [`%${hash}%`, `%${coopname}%`]
    );
    return parseInt(row[0]?.cnt ?? '0', 10);
  }

  private async countDeltasByHash(hash: string, coopname: string): Promise<number> {
    const row = await this.deltaRepository.manager.query(
      `SELECT COUNT(*) AS cnt FROM blockchain_deltas d
       WHERE d.code = $1 AND d.table IN ('wjournal','journal')
         AND LOWER(d.value ->> 'process_hash') = $2
         AND d.scope = $3`,
      [LEDGER2_CODE, hash, coopname]
    );
    return parseInt(row[0]?.cnt ?? '0', 10);
  }

  private async countDocumentsByHash(hash: string, coopname: string): Promise<number> {
    // MVP: по ProcessView мы не хотим повторять тяжёлую выборку в листинге.
    // Грубая оценка: считаем уникальные документы в делтах, где process_hash
    // совпадает. Для сводки достаточно быстрой оценки.
    const row = await this.deltaRepository.manager.query(
      `SELECT COUNT(*) AS cnt FROM blockchain_deltas d
       WHERE d.code = $1 AND d.table IN ('wjournal','journal')
         AND LOWER(d.value ->> 'process_hash') = $2
         AND d.scope = $3`,
      [LEDGER2_CODE, hash, coopname]
    );
    // actions → документ считаем как "1 если есть хоть одна дельта".
    return parseInt(row[0]?.cnt ?? '0', 10) > 0 ? 1 : 0;
  }

  private async cacheGet(key: string): Promise<ProcessView | null> {
    try {
      const client = this.redisClient.publisher;
      if (client.status !== 'ready') return null;
      const raw = await client.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Восстанавливаем Date-поля
      parsed.first_seen_at = new Date(parsed.first_seen_at);
      parsed.last_seen_at = new Date(parsed.last_seen_at);
      for (const a of parsed.actions ?? []) a.created_at = new Date(a.created_at);
      for (const d of parsed.delta_history ?? []) d.created_at = new Date(d.created_at);
      return parsed as ProcessView;
    } catch (e: any) {
      this.logger.warn(`ProcessRegistry cache read failed: ${e?.message}`);
      return null;
    }
  }

  private async cacheSet(key: string, view: ProcessView): Promise<void> {
    try {
      const client = this.redisClient.publisher;
      if (client.status !== 'ready') return;
      await client.set(key, JSON.stringify(view), 'EX', CACHE_TTL_SECONDS);
    } catch (e: any) {
      this.logger.warn(`ProcessRegistry cache write failed: ${e?.message}`);
    }
  }
}
