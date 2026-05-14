import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ledger2Contract } from 'cooptypes';
import Redis from 'ioredis';
import { DeltaEntity } from '~/infrastructure/database/typeorm/entities/delta.entity';
import { ActionEntity } from '~/infrastructure/database/typeorm/entities/action.entity';
import { DocumentAggregator } from '~/domain/document/aggregators/document.aggregator';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  PROCESS_HASH_LOCATOR,
  KNOWN_PROCESS_TYPES,
  OPERATION_CODE_TO_PROCESS_TYPE,
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

const LEDGER2_CODE = Ledger2Contract.contractName.production;
// Epic 1 addendum (2026-04-18): apply orchestrator + 3 atomic inlines.
// Phase A якорится по blockchain_actions (а не deltas), поскольку wjournal
// и journal таблицы убраны из контракта (история = action traces).
//
// HARD_LIMIT — предельное число операций (actions + deltas + documents),
// которое один процесс может содержать. В проде один процесс = одна
// транзакция = ≤ 3 apply + соответствующие inline walletop/debit/credit
// (итого ~12 actions) + entity-дельты одной таблицы. 200 — страховка от
// unbounded scan при заведомо некорректном process_hash или ошибке в локаторе.
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
 * Алгоритм двухфазный (Epic 1 addendum, 2026-04-18):
 *   - Phase A — anchor scan по `blockchain_actions WHERE account='ledger2' AND
 *     name='apply' AND data->>'process_hash'=X`. Из apply берётся operation_code
 *     → process_type через `OPERATION_CODE_TO_PROCESS_TYPE`. Все 4 связанных
 *     action (apply + walletop + debit + credit) с этим process_hash идут
 *     в actions[].
 *   - Phase B — fan-out scan по `PROCESS_HASH_LOCATOR` (entity-таблицы).
 *   - Phase C — выделение документов через DocumentFieldDetector + DocumentAggregator.
 *
 * История проводок не лежит в RAM-таблицах ledger2 — она реконструируется
 * на бэкенде из blockchain_actions + blockchain_deltas (для accounts/wallets).
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
   * @throws NotFoundException если ни одного ledger2::apply с process_hash не найдено
   * @throws BadRequestException при превышении HARD_LIMIT или неизвестном operation_code/process_type
   */
  async getProcess(processHash: string, coopname: string): Promise<ProcessView> {
    const normHash = this.normalizeHash(processHash);

    const cacheKey = `process::${coopname}::${normHash}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    // ---------- Phase A: cross-account scan (code review K2) ----------
    // Собираем ВСЕ actions по process_hash и coopname — не только ledger2.
    // process_hash = единая нитка процесса, по которой нужно собрать связанные
    // действия source-контрактов (wallet::depcpl, registrator::regist,
    // capital::*, marketplace::*, soviet::*) + inline ledger2-трио
    // (apply + walletop + debit + credit).
    //
    // Index: idx_actions_process_hash (не-partial, full-table) — покрывает
    // оба случая (ledger2-only и cross-account).
    const allActions = await this.actionRepository
      .createQueryBuilder('a')
      .where(`LOWER(a.data ->> 'process_hash') = :hash`, { hash: normHash })
      .andWhere(`a.data ->> 'coopname' = :coop`, { coop: coopname })
      .orderBy('a.block_num', 'ASC')
      .addOrderBy('a.global_sequence', 'ASC')
      .getMany();

    if (allActions.length === 0) {
      throw new NotFoundException(`Процесс с хэшем ${normHash} не найден`);
    }

    // process_type выводим из ledger2::apply (он всегда присутствует в трио).
    const applyAnchor = allActions.find((a) => a.account === LEDGER2_CODE && a.name === 'apply');
    if (!applyAnchor) {
      throw new BadRequestException(
        `Якорь ledger2::apply отсутствует для process_hash=${normHash}; без него нельзя вывести process_type`
      );
    }
    const applyData = (applyAnchor.data ?? {}) as Record<string, unknown>;
    const operationCode = String(applyData.operation_code ?? '').trim();
    const processType = OPERATION_CODE_TO_PROCESS_TYPE[operationCode];
    if (!processType) {
      this.logger.error(
        `ProcessRegistry: operation_code='${operationCode}' нет в OPERATION_CODE_TO_PROCESS_TYPE (hash=${normHash}). Синхронизируйте cooptypes/ledger2 с OPERATION_REGISTRY.`
      );
      throw new BadRequestException(
        `Неизвестный operation_code: ${operationCode}. OPERATION_CODE_TO_PROCESS_TYPE требует обновления.`
      );
    }
    if (!KNOWN_PROCESS_TYPES.has(processType)) {
      throw new BadRequestException(
        `Неизвестный process_type: ${processType}. PROCESS_HASH_LOCATOR требует обновления.`
      );
    }

    // ---------- Phase B: fan-out scan по сущностным таблицам ----------
    const locations: HashLocation[] = PROCESS_HASH_LOCATOR[processType] ?? [];
    const entityDeltas = await this.scanEntityDeltas(locations, normHash, coopname);

    // ---------- сборка delta_history (только entity-дельты) ----------
    const allDeltas = entityDeltas.map((d) => this.toDeltaView(d)).sort(this.compareByBlock);

    this.enforceLimit(allDeltas.length, 'delta_history', normHash);
    this.enforceLimit(allActions.length, 'actions', normHash);

    // ---------- Phase C: документы ----------
    const documents = await this.extractDocuments(allDeltas);

    const firstAt = allActions[0].created_at;
    const lastAt = allActions[allActions.length - 1].created_at;

    const view: ProcessView = {
      process_type: processType,
      process_hash: normHash,
      coopname,
      first_seen_at: allDeltas[0]?.created_at ?? firstAt,
      last_seen_at: allDeltas[allDeltas.length - 1]?.created_at ?? lastAt,
      actions: allActions.map(this.toActionView).sort(this.compareByBlock),
      delta_history: allDeltas,
      documents,
    };

    await this.cacheSet(cacheKey, view);
    return view;
  }

  /**
   * Листинг процессов с пагинацией.
   *
   * Epic 1 addendum: вместо wjournal-deltas используем blockchain_actions
   * для apply'ев (один apply = один процесс). operation_code → processType
   * выводим через OPERATION_CODE_TO_PROCESS_TYPE.
   */
  async listProcesses(
    filter: ProcessesFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<ProcessSummary>> {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.max(1, Math.min(100, pagination.limit ?? 10));
    const offset = (page - 1) * limit;

    // Фильтр по processType трансформируется в список operation_code, т.к. в
    // blockchain_actions есть только operation_code (process_type не пишется в
    // data — его выводит backend через OPERATION_CODE_TO_PROCESS_TYPE).
    const operationCodesForFilter = filter.processType
      ? Object.entries(OPERATION_CODE_TO_PROCESS_TYPE)
          .filter(([, pt]) => pt === filter.processType)
          .map(([oc]) => oc)
      : null;

    const params: any[] = [LEDGER2_CODE, filter.coopname];
    let pIdx = 3;
    let operationCodeClause = '';
    if (operationCodesForFilter && operationCodesForFilter.length > 0) {
      operationCodeClause = ` AND a.data ->> 'operation_code' = ANY($${pIdx})`;
      params.push(operationCodesForFilter);
      pIdx += 1;
    }
    let usernameClause = '';
    if (filter.username) {
      usernameClause = ` AND a.data ->> 'username' = $${pIdx}`;
      params.push(filter.username);
      pIdx += 1;
    }
    let fromBlockClause = '';
    if (filter.fromBlock) {
      fromBlockClause = ` AND a.block_num >= $${pIdx}`;
      params.push(filter.fromBlock);
      pIdx += 1;
    }
    let toBlockClause = '';
    if (filter.toBlock) {
      toBlockClause = ` AND a.block_num <= $${pIdx}`;
      params.push(filter.toBlock);
      pIdx += 1;
    }

    const baseFilter = `
      a.account = $1
      AND a.name = 'apply'
      AND a.data ->> 'coopname' = $2
      AND (a.data ->> 'process_hash') IS NOT NULL
      ${operationCodeClause}
      ${usernameClause}
      ${fromBlockClause}
      ${toBlockClause}
    `;

    const countRow = await this.actionRepository.manager.query(
      `SELECT COUNT(DISTINCT LOWER(a.data ->> 'process_hash')) AS cnt
       FROM blockchain_actions a
       WHERE ${baseFilter}`,
      params
    );
    const totalCount = parseInt(countRow[0]?.cnt ?? '0', 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    // GROUP BY только по (process_hash, coopname) — иначе мульти-операционные
    // процессы (p.cap.rid с двумя operation_code под одним hash; p.reg.accept с
    // payent+putmin; p.mkt.reqst с supply+recv) дают двойные строки
    // и totalCount (считаемый через DISTINCT process_hash) не совпадает с
    // items.length. MIN(operation_code) → любой из двух одинаково выводит
    // processType через OPERATION_CODE_TO_PROCESS_TYPE (у p.cap.rid оба
    // operation_code маппятся в один тип; для multi-op типа p.reg.accept тоже
    // единый процесс).
    const limitIdx = pIdx;
    params.push(limit);
    pIdx += 1;
    const offsetIdx = pIdx;
    params.push(offset);

    const rows = await this.actionRepository.manager.query(
      `SELECT
         MIN(a.data ->> 'operation_code')     AS "operationCode",
         LOWER(a.data ->> 'process_hash')     AS "processHash",
         (a.data ->> 'coopname')              AS "coopname",
         MIN(a.data ->> 'username')           AS "username",
         MIN(a.created_at)                    AS "firstSeenAt",
         MAX(a.created_at)                    AS "lastSeenAt",
         MAX(a.block_num)                     AS "lastBlockNum"
       FROM blockchain_actions a
       WHERE ${baseFilter}
       GROUP BY LOWER(a.data ->> 'process_hash'),
                a.data ->> 'coopname'
       ORDER BY MAX(a.block_num) DESC, MAX(a.created_at) DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    // Per-row counts (actions/deltas/documents) удалены из ProcessSummary:
    // на N=100 строк × 3 SQL = 300 запросов на каждый listProcesses =
    // connection pool exhaustion под нагрузкой. Счётчики доступны через
    // getProcess(hash) для конкретного процесса.
    const items: ProcessSummary[] = (rows as any[])
      .map((r): ProcessSummary | null => {
        const derivedType = OPERATION_CODE_TO_PROCESS_TYPE[r.operationCode];
        if (!derivedType || !KNOWN_PROCESS_TYPES.has(derivedType)) {
          this.logger.warn(
            `listProcesses: неизвестный operation_code='${r.operationCode}' для hash=${r.processHash} — строка пропущена`
          );
          return null;
        }
        return {
          processType: derivedType,
          processHash: r.processHash,
          coopname: r.coopname,
          username: r.username ?? null,
          firstSeenAt: new Date(r.firstSeenAt),
          lastSeenAt: new Date(r.lastSeenAt),
        };
      })
      .filter((x): x is ProcessSummary => x !== null);

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

  // scanActions удалён в Epic 1 addendum: actions теперь приходят из якоря
  // Phase A (anchors), для них достаточно одного запроса по
  // blockchain_actions[ledger2].

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
    a: { block_num: number; created_at: Date; global_sequence?: string },
    b: { block_num: number; created_at: Date; global_sequence?: string }
  ): number => {
    if (a.block_num !== b.block_num) return a.block_num - b.block_num;
    const t = a.created_at.getTime() - b.created_at.getTime();
    if (t !== 0) return t;
    // В одном блоке created_at может совпадать до миллисекунды; порядок
    // детерминирован только через global_sequence (есть у actions). Для
    // deltas tiebreaker'а нет — оставляем stable по первым двум ключам.
    const ga = a.global_sequence ? BigInt(a.global_sequence) : 0n;
    const gb = b.global_sequence ? BigInt(b.global_sequence) : 0n;
    return ga < gb ? -1 : ga > gb ? 1 : 0;
  };

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
