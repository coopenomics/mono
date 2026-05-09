/**
 * Бэкенд-конфигурация ProcessRegistry.
 *
 * Источник правды по операциям/процессам — пакет `cooptypes` (модуль `Ledger2`,
 * который зеркалит `components/contracts/cpp/lib/core/ledger2/operations.hpp`
 * и `processes.hpp`). Никаких списков операций или процессов здесь не
 * хардкодим — всё выводится из `Ledger2.LEDGER2_OPERATION_REGISTRY` и
 * `Ledger2.LEDGER2_PROCESS_REGISTRY`.
 *
 * Уникально бэкендское знание — лишь то, где в `blockchain_deltas` лежит
 * entity-hash процесса (имя таблицы + имя поля), + редкие отклонения от
 * контрактного `operation_code → process_type` маппинга (например, коммиты
 * РИД группируются backend'ом в отдельный процесс `p.cap.commit`, хотя
 * контракт пишет их под `p.cap.rid`). Ниже только это.
 *
 * См. architecture.md §4.3.
 */
import { Ledger2 } from 'cooptypes';

export type HashLocation = {
  code: string; // имя контракта (например "capital")
  table: string; // имя таблицы
  field: string; // имя поля внутри value.jsonb
};

/**
 * Бэкенд-оверрайды контрактного маппинга `operation_code → process_type`.
 *
 * Причина: для UX коммиты РИД (`o.cap.commit`) лучше сгруппировать в отдельный
 * процесс «жизнь одобрённых коммитов проекта» (`p.cap.commit`), а не сваливать
 * в общий процесс `p.cap.rid` (акт-2), где уже находятся accept + repay.
 * На контракте это выражается тем же `p.cap.rid`, но бэкенд накладывает свой
 * вид, чтобы `project_hash` был якорем отдельного представления процесса.
 */
const BACKEND_OVERRIDES: Record<string, string> = {
  'o.cap.commit': 'p.cap.commit',
};

/**
 * Phase A: operation_code → process_type. Строится из cooptypes +
 * бэкенд-оверрайдов.
 */
export const OPERATION_CODE_TO_PROCESS_TYPE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Ledger2.LEDGER2_OPERATION_REGISTRY.map((op) => [
      op.code,
      BACKEND_OVERRIDES[op.code] ?? op.process_type,
    ]),
  ),
);

/**
 * Phase B: process_type → [HashLocation] — где в `blockchain_deltas` искать
 * `process_hash` под «родным» именем поля. Это уникально бэкендское знание.
 *
 * Ключи — все `process_type`, которые может увидеть Phase A:
 *   - контрактные `process_type` из `Ledger2.LEDGER2_PROCESS_REGISTRY`,
 *   - плюс бэкенд-only `process_type` из `BACKEND_OVERRIDES` (значения).
 *
 * Если для какого-то ключа нет HashLocation (например, `p.sov.axncnv` —
 * одноактовый процесс без entity-hash в сущностной таблице), массив пустой.
 * Отсутствие записи → fail-fast ошибка в getProcess («локатор требует
 * обновления»).
 */
export const PROCESS_HASH_LOCATOR: Readonly<Record<string, HashLocation[]>> = Object.freeze({
  // registrator::candidates2.registration_hash — заявка пайщика на вступление.
  // Одним process_hash связаны: reguser/confirmreg/declinereg/declinepay +
  // два inline ledger2::apply (o.reg.payent + o.reg.putmin) с тем же hash.
  'p.reg.accept': [{ code: 'registrator', table: 'candidates2', field: 'registration_hash' }],

  // p.cap.debt — выдача/возврат беспроцентного займа пайщика.
  // Один process_hash (= debt_hash), две операции: o.cap.lend (при выдаче)
  // и o.cap.repay (при возврате через акт-2).
  'p.cap.debt': [{ code: 'capital', table: 'debts', field: 'debt_hash' }],

  // p.cap.commit — backend-only: одобрение коммита мастером (Dr 08 / Cr 80).
  // `o.cap.commit` эмитится на каждом `capital::approvecmmt`. process_hash =
  // project_hash (commit-entity удаляется сразу после одобрения, project —
  // долгоживущий якорь; все коммиты проекта группируются в один процесс).
  'p.cap.commit': [{ code: 'capital', table: 'projects', field: 'project_hash' }],

  // p.cap.rid — внесение РИД в паевой фонд (полный жизненный цикл).
  // До ЧЕТЫРЁХ операций на один process_hash (= result_hash):
  //   1. o.cap.accept  (Dr 04 / Cr 08, NONE) — приём РИД в signact2
  //   2. o.cap.repay   (Dr 80 / Cr 58, TRANSFER) — возврат займа, опционально
  //   3. o.cap.cnvshr  (TRANSFER w.cap.gen → w.wal.share) — финальная конвертация в ЦК
  //   4. o.cap.cnvbl   (TRANSFER w.cap.gen → w.cap.blago) — финальная конвертация в Благорост
  // o.cap.commit разнесён backend'ом в отдельный процесс p.cap.commit (см. выше).
  // Объект `capital::results` живёт от pushrslt до convertsegm (анкер процесса).
  'p.cap.rid': [{ code: 'capital', table: 'results', field: 'result_hash' }],

  'p.cap.import': [{ code: 'capital', table: 'contributors', field: 'contributor_hash' }],

  // p.cap.invest — TRANSFER w.wal.share → w.cap.blago без бухпроводок (ADR-003).
  'p.cap.invest': [{ code: 'capital', table: 'contributors', field: 'contributor_hash' }],

  // capital::pgproperties.property_hash — приём имущества в паевой фонд.
  'p.cap.prop': [{ code: 'capital', table: 'pgproperties', field: 'property_hash' }],

  'p.wal.depo':   [{ code: 'wallet', table: 'deposits',  field: 'deposit_hash' }],
  'p.wal.wthdrw': [{ code: 'wallet', table: 'withdraws', field: 'withdraw_hash' }],

  // p.cap.wthcap — возврат паевого из ЦПП Благорост в ЦК.
  // Жизнь запроса: createwthd3 → capauthwthd3 / capdeclwthd3 → approvewthd3.
  // Сущностная таблица — `capital::prgwithdraws.withdraw_hash`.
  'p.cap.wthcap': [{ code: 'capital', table: 'prgwithdraws', field: 'withdraw_hash' }],

  // marketplace::requests.hash — поле так и называется `hash`.
  'p.mkt.reqst': [{ code: 'marketplace', table: 'requests', field: 'hash' }],

  // p.sov.axncnv — одноактовый процесс: данные из blockchain_actions +
  // документ statement (DocumentFieldDetector).
  'p.sov.axncnv': [],

  // p.mig.trans — транзитная миграция legacy → ledger2. Единый process_type
  // для 4 миграционных операций (o.mig.*). Entity-hash в сущностных таблицах
  // нет (миграция пишет только wjournal/journal + accounts2/wallets2 deltas).
  'p.mig.trans': [],

  // p.adj.fix — ручные корректировки председателя (o.adj.walmove + o.adj.rev).
  // Одноактовые, без entity-hash: данные читаются напрямую из blockchain_actions
  // (поле `data.process_hash` уникально для каждой корректировки).
  'p.adj.fix': [],
});

/**
 * Все известные process_type, которые может встретить ProcessRegistryService.
 * Включает контрактные (из cooptypes) + бэкенд-only (из BACKEND_OVERRIDES).
 */
export const KNOWN_PROCESS_TYPES: ReadonlySet<string> = new Set(Object.keys(PROCESS_HASH_LOCATOR));

// ===============================================================
// Integrity check (runtime): каждый process_type из
// OPERATION_CODE_TO_PROCESS_TYPE должен быть в PROCESS_HASH_LOCATOR.
// Срабатывает при старте модуля — fail-fast при рассинхронизации.
// ===============================================================
{
  const missing: string[] = [];
  for (const pt of Object.values(OPERATION_CODE_TO_PROCESS_TYPE)) {
    if (!KNOWN_PROCESS_TYPES.has(pt)) missing.push(pt);
  }
  if (missing.length > 0) {
    throw new Error(
      `[process-hash-locator] PROCESS_HASH_LOCATOR не содержит process_type: ` +
        `${[...new Set(missing)].join(', ')}. ` +
        `Обнови локатор или cooptypes/src/ledger2/.`,
    );
  }
}
