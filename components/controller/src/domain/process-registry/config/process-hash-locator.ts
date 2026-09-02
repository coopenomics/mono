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
 *
 * Оверрайд сильнее имени, эмитированного контрактом: это сознательное
 * расхождение представления с цепью, а не догадка об имени нитки. Иначе после того,
 * как контракт начал эмитить `p.cap.rid`, отдельный процесс коммитов исчез бы,
 * а его нитка (якорь — `project_hash`) уехала бы в локатор `p.cap.rid`, который
 * ищет `result_hash`, и сущность перестала бы находиться.
 */
export const BACKEND_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
  'o.cap.commit': 'p.cap.commit',
});

/**
 * Операции, которые физически идут внутри чужой нитки процесса и потому не
 * дают ей имени.
 *
 * `branch::accrue` и `branch::retfee` вызываются инлайн контрактом-источником с
 * его собственным `process_hash`: `marketplace::signiss2` зачисляет членский
 * взнос в общий кошелёк КУ по хэшу заказа, `marketplace::accretrn` возвращает
 * его по хэшу заявки на возврат. Поэтому `o.brn.common` / `o.brn.retfee` живут
 * в нитках поставки и гарантийного возврата, хотя в реестре операций объявлены
 * под собственным `p.brn.fees` (там они относятся к экономике КУ).
 *
 * Без этого списка у нитки два претендента на имя, и она называлась по
 * алфавиту `operation_code`: `o.brn.common` < `o.mkt.lock`, поэтому поставка
 * подписывалась «Членские взносы кооперативного участка».
 *
 * Список нужен только для блоков, записанных до того, как контракт начал
 * эмитить `process_type` в `ledger2::apply`. Для новых операций имя читается из
 * цепи — дописывать сюда ничего не нужно.
 */
export const OPERATIONS_NOT_NAMING_PROCESS: ReadonlySet<string> = new Set([
  'o.brn.common',
  'o.brn.retfee',
  // o.mkt.refund возвращает членский взнос и в нитке поставки (неиспользованная
  // часть по заказу), и в нитке гарантийного возврата (вторая нога, по хэшу
  // заявки). В реестре операций он объявлен под поставкой, поэтому без этой
  // строки фильтр «Поставка» вытаскивал нитку возврата отдельной строкой,
  // названной поставкой, — а при раскрытии та же нитка называлась возвратом.
  // Имени поставке он не нужен: в нитке заказа всегда есть o.mkt.lock.
  'o.mkt.refund',
]);

/**
 * Phase A: operation_code → process_type. Строится из cooptypes +
 * бэкенд-оверрайдов.
 *
 * Историческая карта: применяется только к блокам без явного `process_type` в
 * данных экшена (см. `OPERATIONS_NOT_NAMING_PROCESS`).
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
  // Одним process_hash (= registration_hash) связаны: reguser/confirmpay/confirmreg +
  // inline ledger2::apply приёма и признания взноса (o.reg.inpay на confirmpay,
  // o.reg.setmin + o.reg.setent на confirmreg).
  'p.reg.accept': [{ code: 'registrator', table: 'candidates2', field: 'registration_hash' }],

  // p.reg.refund — возврат регистрационного взноса при отказе совета.
  // Отдельный процесс (приём прерывается, начинается возврат): одна операция
  // o.reg.refund на declinereg, process_hash = тот же registration_hash, что
  // жил в candidates2 (запись кандидата удаляется, но дельта остаётся в истории).
  'p.reg.refund': [{ code: 'registrator', table: 'candidates2', field: 'registration_hash' }],

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

  // p.cap.preimp — первичный учёт РИД-взноса до перехода кооператива на
  // электронный учёт (`o.cap.preimp`, ISSUE w.cap.preimp). Сущностной таблицы
  // под этот учёт пока нет — пред-импорт-записи живут только в
  // `userwallets[w.cap.preimp]`. Process_hash берётся из blockchain_actions
  // (как у одноактовых процессов).
  'p.cap.preimp': [],

  'p.wal.depo':   [{ code: 'wallet', table: 'deposits',  field: 'deposit_hash' }],
  'p.wal.wthdrw': [{ code: 'wallet', table: 'withdraws', field: 'withdraw_hash' }],

  // p.cap.wthcap — возврат паевого из ЦПП Благорост в ЦК.
  // Жизнь запроса: createwthd3 → capauthwthd3 / capdeclwthd3 → approvewthd3.
  // Сущностная таблица — `capital::prgwithdraws.withdraw_hash`.
  'p.cap.wthcap': [{ code: 'capital', table: 'prgwithdraws', field: 'withdraw_hash' }],

  // marketplace — членская модель «Стола заказов». Три entity-таблицы из
  // contracts/cpp/lib/domain/table_marketplace_*.hpp хранят сами процессы:
  //   - `orders.hash`      — поставка имущества (заказ через каталог).
  //   - `retrequests.hash` — гарантийный возврат имущества.
  //   - `wroffprops.hash`  — проект решения совета о списании скоропорта.
  // Имя поля — `hash` (а не `order_hash`/`request_hash`); все три таблицы
  // используют один и тот же `checksum256 hash` как первичный
  // process-якорь. Через них Phase B resolution в blockchain_deltas
  // отдаёт current state процесса вместе с Phase-A экшенами.
  'p.mkt.supply': [{ code: 'marketplace', table: 'orders',      field: 'hash' }],
  'p.mkt.return': [{ code: 'marketplace', table: 'retrequests', field: 'hash' }],
  'p.mkt.wroff':  [{ code: 'marketplace', table: 'wroffprops',  field: 'hash' }],

  // edubridge — ЦПП «Образование». Две entity-таблицы из
  // contracts/cpp/lib/domain/table_edubridge_*.hpp:
  //   - `edusubs.sub_hash` — подписка на курс (конвертация членского взноса
  //     o.edu.conv + opensub/extendsub; запись стирается на expiresub).
  //   - `edurids.rid_hash` — заявление преподавателя о паевом взносе РИД
  //     (живёт до решения совета; acceptrid/declinerid стирают запись).
  'p.edu.access': [{ code: 'edubridge', table: 'edusubs', field: 'sub_hash' }],
  'p.edu.rid':    [{ code: 'edubridge', table: 'edurids', field: 'rid_hash' }],
  //   - `educontracts.contract_hash` — договор УХД преподавателя; приложения
  //     к нему (`eduannexes.annex_hash`) живут только до подписи председателя.
  'p.edu.teach':  [{ code: 'edubridge', table: 'educontracts', field: 'contract_hash' }],

  // requirement b6 «Экономика КУ».
  // p.brn.fees — распределение членских взносов КУ: ручное распределение
  // председателем (branch::distribute, round_hash) и перевод персональных
  // средств доверенным (o.brn.conv, convert_hash). Оба хэша генерятся
  // backend'ом и в сущностных таблицах не хранятся — данные читаются из
  // blockchain_actions (как у p.adj.fix), поэтому локаций нет.
  //
  // Хэш заказа (`marketplace.orders.hash`) здесь НЕ значится: зачисление взноса
  // (branch::accrue) идёт внутри нитки поставки и её имени не определяет
  // (см. OPERATIONS_NOT_NAMING_PROCESS). Пока обе нитки были объявлены на одном
  // якоре, поставка подписывалась именем этого процесса.
  'p.brn.fees': [],

  // p.brn.aid — материальная помощь доверенного: process_hash = aids.hash.
  'p.brn.aid': [{ code: 'branch', table: 'aids', field: 'hash' }],

  // p.sov.tax — перечисление удержанного налога в бюджет: process_hash =
  // taxes.hash. Запись живёт от отправки бухгалтером до подтверждения кассиром
  // и после финала стирается, поэтому у завершённого платежа анкера в таблице
  // уже нет — деталь собирается из журнала действий.
  'p.sov.tax': [{ code: 'soviet', table: 'taxes', field: 'hash' }],

  // p.brn.spend — оплата расхода КУ из общего кошелька: process_hash = spends.hash.
  'p.brn.spend': [{ code: 'branch', table: 'spends', field: 'hash' }],

  // p.cap.pgexp — пополнение пула программных расходов (o.cap.pgtop, ISSUE
  // w.cap.pgexp). Одноактовый, process_hash синтетический (sha256 в контракте) —
  // entity-таблицы нет, данные из blockchain_actions.
  'p.cap.pgexp': [],

  // p.exp.expns — расход по СЗ (шасси expense): o.exp.blgadv/blgdir (оплата) +
  // опц. o.exp.over + o.exp.advrpt (отчёт) + опц. o.exp.advret (возврат).
  // Анкер процесса — proposal_hash в `expense::proposals`.
  'p.exp.expns': [{ code: 'expense', table: 'proposals', field: 'proposal_hash' }],

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
// Integrity check (runtime): локатор обязан знать каждое имя процесса,
// которое может приехать из цепи. Срабатывает при старте модуля —
// fail-fast при рассинхронизации.
//
// Два независимых источника таких имён, и проверять нужно оба:
//   1. историческая карта operation_code → process_type (старые блоки);
//   2. реестр процессов контракта — имя эмитится в ledger2::apply, поэтому
//      увидеть можно любое имя из PROCESS_REGISTRY, даже если сегодня ни одна
//      операция под ним не объявлена. Раньше проверялся только (1), и новое
//      имя, добавленное в processes.hpp, доезжало до 400 в getProcess.
// ===============================================================
{
  const missing: string[] = [];
  for (const pt of Object.values(OPERATION_CODE_TO_PROCESS_TYPE)) {
    if (!KNOWN_PROCESS_TYPES.has(pt)) missing.push(pt);
  }
  for (const { type } of Ledger2.LEDGER2_PROCESS_REGISTRY) {
    if (!KNOWN_PROCESS_TYPES.has(type)) missing.push(type);
  }
  for (const pt of Object.values(BACKEND_OVERRIDES)) {
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
