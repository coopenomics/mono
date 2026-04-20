/**
 * Таблица соответствия `process_type → таблицы/поля дельт, где искать process_hash`.
 *
 * Используется сервисом `ProcessRegistryService` в phase B (fan-out scan) для
 * нахождения всех дельт сущности, относящейся к процессу. Каждая запись
 * указывает, в какой таблице какого контракта хранится entity-hash процесса
 * под каким именем поля.
 *
 * Расширяется при появлении новых процессов. Отсутствие записи для известного
 * `process_type` → fail-fast ошибка в getProcess.
 *
 * Имена таблиц/полей — точная сверка с контрактами (`cpp/.../entities/*.hpp`,
 * `cpp/lib/domain/table_*.hpp`). При изменении схемы контракта нужно обновить
 * и этот файл, и миграцию V2.1.0 (индексы по (value->>'field', scope)).
 *
 * См. architecture.md §4.3.
 */
export type HashLocation = {
  code: string; // имя контракта (например "capital")
  table: string; // имя таблицы
  field: string; // имя поля внутри value.jsonb
};

export const PROCESS_HASH_LOCATOR: Record<string, HashLocation[]> = {
  // registrator::candidates2.registration_hash — заявка пайщика на вступление.
  // Одним process_hash связаны: reguser/confirmreg/declinereg/declinepay +
  // два inline ledger2::apply (entrfee + minshare) с тем же hash.
  'reg.regist': [{ code: 'registrator', table: 'candidates2', field: 'registration_hash' }],

  // cap.loan — выдача/возврат беспроцентного займа пайщика.
  // Один process_hash (= debt_hash), два action_code: cap.lnissue (Dr 58 / Cr 51
  // при выдаче) и cap.lnrepay (Dr 80 / Cr 58 при возврате через акт-2).
  'cap.loan': [{ code: 'capital', table: 'debts', field: 'debt_hash' }],

  // cap.act2res — подписание акта-2 (внесение РИД в паевой фонд).
  // Пересмотр 2026-04-20: теперь до ТРЁХ action_code на один process_hash:
  //   1. cap.commit   (Dr 08 / Cr 80) — коммит РИД в ЦПП «Генератор»
  //   2. cap.accept   (Dr 04 / Cr 08) — приём РИД в паевой фонд
  //   3. cap.lnrepay  (Dr 80 / Cr 58) — возврат займа, если был (опционально)
  // UI группирует actions по action_code как discriminator (три раздельных
  // эффекта внутри одного процесса cap.act2res).
  //
  // Entity-дельта — строго `capital::results`. Сегменты/долги живут на
  // project_hash и не связаны с актом-2 напрямую.
  'cap.act2res': [{ code: 'capital', table: 'results', field: 'result_hash' }],

  'cap.capimp': [{ code: 'capital', table: 'contributors', field: 'contributor_hash' }],

  // cap.invest — инвестиция пайщика в ЦПП Благорост (wallet-only перенос
  // 2001 → 9001, без Dr/Cr-проводок). process_hash — contributor_hash.
  'cap.invest': [{ code: 'capital', table: 'contributors', field: 'contributor_hash' }],

  // capital::pgproperties.property_hash — приём имущества в паевой фонд.
  'cap.act2prp': [{ code: 'capital', table: 'pgproperties', field: 'property_hash' }],

  'wall.deposit': [{ code: 'wallet', table: 'deposits', field: 'deposit_hash' }],
  'wall.withdrw': [{ code: 'wallet', table: 'withdraws', field: 'withdraw_hash' }],

  // marketplace::requests.hash — поле так и называется `hash` (не `request_hash`).
  'mkt.offereq': [{ code: 'marketplace', table: 'requests', field: 'hash' }],

  // sov.axncnv — одноактовый процесс: данные из blockchain_actions + документ
  // statement (DocumentFieldDetector).
  'sov.axncnv': [],

  // mig.transit — транзитная миграция legacy → ledger2. Пересмотр 2026-04-20:
  // единый process_type для шести миграционных action_code (TRANSIT_*), т.к.
  // все они относятся к одному кооперативу и выполняются в одной транзакции.
  'mig.transit': [],
};

/**
 * Все известные process_type, зарегистрированные в локаторе.
 * Используется в fail-fast проверке: если пришёл неизвестный тип, локатор
 * требует обновления.
 */
export const KNOWN_PROCESS_TYPES: ReadonlySet<string> = new Set(Object.keys(PROCESS_HASH_LOCATOR));

/**
 * Обратный маппинг ledger2 action_code → process_type.
 *
 * Источник истины: ACTION_REGISTRY в `cpp/lib/core/ledger2/actions.hpp`.
 * Должен синхронизироваться вручную при изменении контракта.
 *
 * Используется в Phase A: бэкенд читает blockchain_actions для
 * `ledger2::apply` (где есть только action_code), и через эту таблицу
 * выводит process_type.
 *
 * cap.commit + cap.accept + cap.lnrepay — до трёх action_code на один
 * process_hash в рамках процесса cap.act2res (пересмотр 2026-04-20).
 * cap.lnissue и cap.lnrepay — оба части процесса cap.loan, но lnrepay
 * также участвует в cap.act2res когда возврат делает пайщик через акт-2.
 */
export const ACTION_CODE_TO_PROCESS_TYPE: Record<string, string> = {
  // registrator
  'reg.entrfee': 'reg.regist',
  'reg.minshare': 'reg.regist',
  // wallet
  'wall.depcpl': 'wall.deposit',
  'wall.wthcpl': 'wall.withdrw',
  // capital: импорт
  'cap.import': 'cap.capimp',
  // capital: заём (выдача + возврат)
  'cap.lnissue': 'cap.loan',
  'cap.lnrepay': 'cap.act2res',
  // capital: акт-2 (commit + accept)
  'cap.commit': 'cap.act2res',
  'cap.accept': 'cap.act2res',
  // capital: имущественный взнос, инвестиция
  'cap.act2prp': 'cap.act2prp',
  'cap.invest': 'cap.invest',
  // marketplace
  'mkt.supplcnf': 'mkt.offereq',
  'mkt.recvcnf': 'mkt.offereq',
  // soviet
  'sov.axncnv': 'sov.axncnv',
  // migration — 4 TRANSIT_* относятся к единому процессу mig.transit.
  // Программные кошельки Благороста (9001) и Генератора (10001) мигрируются
  // прямым emplace в wallets2 БЕЗ inline apply, поэтому в blockchain_actions
  // их не видно — только в blockchain_deltas wallets2.
  'mig.minshr': 'mig.transit',
  'mig.share': 'mig.transit',
  'mig.entry': 'mig.transit',
  'mig.rid': 'mig.transit',
};
