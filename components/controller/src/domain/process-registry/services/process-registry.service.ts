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
  OPERATIONS_NOT_NAMING_PROCESS,
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

/** Ссылка на одну операцию нитки: код операции + имя нитки, если контракт его эмитил. */
type ProcessApplyRef = {
  operationCode: string;
  processType: string | null;
};

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

    // Имя нитки берём из ledger2::apply (он всегда присутствует в трио).
    const applies = allActions.filter((a) => a.account === LEDGER2_CODE && a.name === 'apply');
    if (applies.length === 0) {
      throw new BadRequestException(
        `Якорь ledger2::apply отсутствует для process_hash=${normHash}; без него нельзя вывести process_type`
      );
    }
    const naming = this.resolveProcessNaming(
      applies.map((a) => this.toApplyRef(a.data)),
      normHash
    );
    if (!naming) {
      const codes = applies.map((a) => this.toApplyRef(a.data).operationCode).join(', ');
      this.logger.error(
        `ProcessRegistry: ни одна операция нитки не даёт имени процессу (hash=${normHash}, коды=[${codes}]). Синхронизируйте cooptypes/ledger2 с OPERATION_REGISTRY.`
      );
      throw new BadRequestException(
        `Неизвестные operation_code: ${codes}. OPERATION_CODE_TO_PROCESS_TYPE требует обновления.`
      );
    }
    const processType = naming.processType;
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

    // Фильтр по типу процесса двухчастный: новые блоки несут имя нитки прямо в
    // данных экшена, у старых есть только operation_code — для них имя выводится
    // по исторической карте. Из списка кодов исключаются операции, идущие внутри
    // чужой нитки, иначе фильтр «Членские взносы КУ» вытаскивал бы поставки, в
    // которых взнос зачислялся в общий кошелёк участка.
    const operationCodesForFilter = filter.processType
      ? Object.entries(OPERATION_CODE_TO_PROCESS_TYPE)
          .filter(([oc, pt]) => pt === filter.processType && !OPERATIONS_NOT_NAMING_PROCESS.has(oc))
          .map(([oc]) => oc)
      : null;

    const params: any[] = [LEDGER2_CODE, filter.coopname];
    let pIdx = 3;
    let processTypeClause = '';
    if (filter.processType) {
      const typeIdx = pIdx;
      params.push(filter.processType);
      pIdx += 1;
      if (operationCodesForFilter && operationCodesForFilter.length > 0) {
        const codesIdx = pIdx;
        params.push(operationCodesForFilter);
        pIdx += 1;
        processTypeClause =
          ` AND (a.data ->> 'process_type' = $${typeIdx}` +
          ` OR (a.data ->> 'process_type' IS NULL AND a.data ->> 'operation_code' = ANY($${codesIdx})))`;
      } else {
        processTypeClause = ` AND a.data ->> 'process_type' = $${typeIdx}`;
      }
    }
    let usernameClause = '';
    if (filter.username) {
      usernameClause = ` AND a.data ->> 'username' = $${pIdx}`;
      params.push(filter.username);
      pIdx += 1;
    }
    // Точечная адресация одного процесса по хэшу (deep-link из реестров
    // операций/проводок: клик по № процесса ведёт сюда с раскрытым процессом).
    let processHashClause = '';
    if (filter.processHash) {
      processHashClause = ` AND LOWER(a.data ->> 'process_hash') = $${pIdx}`;
      params.push(filter.processHash.trim().toLowerCase());
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
      ${processTypeClause}
      ${usernameClause}
      ${processHashClause}
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
    // payent+putmin) дают двойные строки и totalCount (считаемый через DISTINCT
    // process_hash) не совпадает с items.length.
    //
    // Операции нитки собираются массивами, а имя выбирается в TS тем же
    // правилом, что и в getProcess (resolveProcessNaming) — иначе список и
    // деталь процесса называют один процесс по-разному. Прежний
    // MIN(operation_code) брал минимум ПО АЛФАВИТУ кода: в нитке поставки
    // `o.brn.common` (взнос в общий кошелёк КУ, инлайн из signiss2) опережал
    // `o.mkt.lock`, и поставка подписывалась «Членские взносы кооперативного
    // участка». MIN(username) по той же причине мог подставить имя участка
    // вместо заказчика.
    //
    // Порядок внутри массивов — по блоку и global_sequence (varchar-колонка,
    // поэтому приведение к numeric: лексикографически '9' > '10').
    const limitIdx = pIdx;
    params.push(limit);
    pIdx += 1;
    const offsetIdx = pIdx;
    params.push(offset);

    const rows = await this.actionRepository.manager.query(
      `SELECT
         ARRAY_AGG(a.data ->> 'operation_code'
                   ORDER BY a.block_num ASC, (a.global_sequence)::numeric ASC) AS "operationCodes",
         ARRAY_AGG(a.data ->> 'process_type'
                   ORDER BY a.block_num ASC, (a.global_sequence)::numeric ASC) AS "processTypes",
         ARRAY_AGG(a.data ->> 'username'
                   ORDER BY a.block_num ASC, (a.global_sequence)::numeric ASC) AS "usernames",
         LOWER(a.data ->> 'process_hash')     AS "processHash",
         (a.data ->> 'coopname')              AS "coopname",
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
    // Строку реестра не выбрасываем никогда: процесс, чьё имя вывести не удалось
    // (незнакомый код операции, запись старее текущего реестра), остаётся видимым
    // с пустым типом — реестр обязан показывать всё, что есть в цепи.
    const items: ProcessSummary[] = (rows as any[]).map((r): ProcessSummary => {
      const codes: (string | null)[] = r.operationCodes ?? [];
      const types: (string | null)[] = r.processTypes ?? [];
      const usernames: (string | null)[] = r.usernames ?? [];
      const applies = codes.map((code, i) => this.toApplyRef({
        operation_code: code,
        process_type: types[i],
      }));

      const naming = this.resolveProcessNaming(applies, r.processHash);
      if (!naming) {
        this.logger.warn(
          `listProcesses: имя нитки не выводится для hash=${r.processHash} (коды=[${codes.join(', ')}]) — строка показана без типа`
        );
      } else if (!KNOWN_PROCESS_TYPES.has(naming.processType)) {
        this.logger.warn(
          `listProcesses: process_type='${naming.processType}' отсутствует в PROCESS_HASH_LOCATOR (hash=${r.processHash}) — локатор требует обновления`
        );
      }

      // Субъект процесса — пайщик той операции, что дала нитке имя. У инлайновых
      // операций экономики КУ в username стоит имя участка, а не заказчика.
      const subject = naming ? usernames[naming.index] : usernames.find((u) => !!u);

      return {
        processType: naming?.processType ?? '',
        processHash: r.processHash,
        coopname: r.coopname,
        username: subject ?? null,
        firstSeenAt: new Date(r.firstSeenAt),
        lastSeenAt: new Date(r.lastSeenAt),
      };
    });

    return { items, totalCount, totalPages, currentPage: page };
  }

  // =====================================================================
  // private helpers
  // =====================================================================

  private toApplyRef(data: unknown): ProcessApplyRef {
    const d = (data ?? {}) as Record<string, unknown>;
    const processType = String(d.process_type ?? '').trim();
    return {
      operationCode: String(d.operation_code ?? '').trim(),
      processType: processType.length > 0 ? processType : null,
    };
  }

  /**
   * Имя нитки процесса и операция, которая его дала.
   *
   * Приоритет — `process_type` из данных экшена: его эмитит контракт, открывший
   * нитку, поэтому имя не зависит ни от порядка операций, ни от их кодов. Для
   * блоков, записанных до появления поля, имя выводится по исторической карте
   * `operation_code → process_type`, из которой исключены операции, идущие
   * внутри чужой нитки (`OPERATIONS_NOT_NAMING_PROCESS`).
   *
   * `null` — ни одна операция нитки имени не даёт (незнакомые коды).
   */
  private resolveProcessNaming(
    applies: ProcessApplyRef[],
    processHash: string
  ): { index: number; processType: string } | null {
    const emitted = applies.findIndex((a) => a.processType !== null);
    if (emitted >= 0) {
      const emittedType = applies[emitted].processType as string;
      const conflicting = applies.find((a) => a.processType !== null && a.processType !== emittedType);
      if (conflicting) {
        this.logger.warn(
          `resolveProcessNaming: под одним process_hash=${processHash} эмитированы разные имена нитки ` +
            `('${emittedType}' и '${conflicting.processType}') — взято первое. Проверьте инициатора нитки в контракте.`
        );
      }
      return { index: emitted, processType: emittedType };
    }

    const historical = (predicate: (a: ProcessApplyRef) => boolean): number =>
      applies.findIndex((a) => predicate(a) && !!OPERATION_CODE_TO_PROCESS_TYPE[a.operationCode]);

    // Сначала операции, которые нитку открывают, и только если таких нет —
    // сопутствующие: иначе процесс потерял бы имя совсем.
    const naming = historical((a) => !OPERATIONS_NOT_NAMING_PROCESS.has(a.operationCode));
    const index = naming >= 0 ? naming : historical(() => true);
    if (index < 0) return null;

    return { index, processType: OPERATION_CODE_TO_PROCESS_TYPE[applies[index].operationCode] };
  }

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
    // Один логический документ (тождество по содержимому = doc_hash) встречается
    // в НЕСКОЛЬКИХ дельта-версиях сущности и с РАЗНЫМ числом подписей: контракт
    // сперва пишет одноподписную версию, затем — двухподписную (вторая подпись —
    // ведущая). Без дедупликации UI показывает один и тот же акт 5-7 раз.
    // Поэтому отдаём ОДНУ запись на документ — версию с максимумом подписей,
    // при равенстве — последнюю по блоку (deltas отсортированы ASC).
    const byContent = new Map<string, ProcessDocumentView>();
    for (const delta of deltas) {
      const v = delta.value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') continue;

      const candidates = this.findDocumentFields(delta.code, delta.table, v);
      for (const { field, value } of candidates) {
        try {
          const signed = value as any;
          const aggregate = await this.documentAggregator.buildDocumentAggregate(signed);
          if (!aggregate) continue;
          const entry: ProcessDocumentView = {
            hash: aggregate.hash || signed.hash || signed.doc_hash || '',
            source: {
              code: delta.code,
              table: delta.table,
              field,
              primary_key: delta.primary_key,
            },
            document: aggregate.document,
            raw: aggregate.rawDocument ?? null,
          };
          const key = (entry.document?.doc_hash || signed.doc_hash || entry.hash || '').toLowerCase();
          if (!key) continue;
          const prev = byContent.get(key);
          const sig = entry.document?.signatures?.length ?? 0;
          const prevSig = prev?.document?.signatures?.length ?? 0;
          if (!prev || sig >= prevSig) byContent.set(key, entry);
        } catch (e: any) {
          this.logger.warn(
            `ProcessRegistry: buildDocumentAggregate упал для ${delta.code}/${delta.table}.${field}: ${e?.message}`
          );
        }
      }
    }
    return [...byContent.values()];
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
