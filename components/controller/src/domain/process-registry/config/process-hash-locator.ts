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

  // capital::debts.debt_hash — выдача/погашение займа.
  'cap.debt': [{ code: 'capital', table: 'debts', field: 'debt_hash' }],

  // cap.act2res — подписание акта-2 (внесение РИД в паевой фонд).
  // Один process_hash (= result_hash), два action_code: cap.act2shr (Dr 04 /
  // Cr 80, приём результата в пай) и cap.act2ln (Dr 80 / Cr 583, погашение
  // займа если был). Backend сливает оба в один process_type cap.act2res —
  // в UI это один процесс, внутри него два apply с разными action_code
  // показаны раздельно (UI группирует actions по action_code как discriminator).
  //
  // Entity-дельта — строго `capital::results`: segments/debts связаны с
  // проектом (project_hash), а не с конкретным результатом акта-2, поэтому
  // их здесь нет. Эффекты по сегментам/долгам видны в actions через
  // ledger2::walletop/debit/credit.
  'cap.act2res': [{ code: 'capital', table: 'results', field: 'result_hash' }],

  'cap.capimp': [{ code: 'capital', table: 'contributors', field: 'contributor_hash' }],

  // capital::pgproperties.property_hash — приём имущества в паевой фонд.
  'cap.act2prp': [{ code: 'capital', table: 'pgproperties', field: 'property_hash' }],

  'wall.deposit': [{ code: 'wallet', table: 'deposits', field: 'deposit_hash' }],
  'wall.withdrw': [{ code: 'wallet', table: 'withdraws', field: 'withdraw_hash' }],

  // marketplace::requests.hash — поле так и называется `hash` (не `request_hash`).
  'mkt.offereq': [{ code: 'marketplace', table: 'requests', field: 'hash' }],

  // sov.axncnv — одноактовый процесс: данные берутся из blockchain_actions +
  // документа statement (детектируется DocumentFieldDetector).
  'sov.axncnv': [],
  // Миграционные процессы — нет сущностных таблиц, только blockchain_actions
  // ledger2::apply/walletop/debit/credit + дельты accounts/wallets.
  'mig.opening': [],
  'mig.rid': [],
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
 * Акт-2 (ACT2_SHARE + ACT2_LOAN) — это ОДИН процесс cap.act2res с ОДНИМ
 * process_hash, но двумя action_code. UI показывает оба эффекта
 * (приём пая + погашение займа) раздельно внутри одного процесса,
 * discriminator — action.data.action_code.
 */
export const ACTION_CODE_TO_PROCESS_TYPE: Record<string, string> = {
  // registrator
  'reg.entrfee': 'reg.regist',
  'reg.minshare': 'reg.regist',
  // wallet
  'wall.depcpl': 'wall.deposit',
  'wall.wthcpl': 'wall.withdrw',
  // capital
  'cap.import': 'cap.capimp',
  'cap.loanrpy': 'cap.debt',
  // cap.act2shr и cap.act2ln — оба части процесса cap.act2res (подписание
  // акта-2). Один process_hash, общий processType; UI группирует actions
  // по action_code для отображения двух раздельных эффектов в одной карточке.
  'cap.act2shr': 'cap.act2res',
  'cap.act2ln': 'cap.act2res',
  'cap.act2prp': 'cap.act2prp',
  // marketplace
  'mkt.supplcnf': 'mkt.offereq',
  'mkt.recvcnf': 'mkt.offereq',
  // soviet
  'sov.axncnv': 'sov.axncnv',
  // migration
  'mig.opncash': 'mig.opening',
  'mig.opnshr': 'mig.opening',
  'mig.opnent': 'mig.opening',
  'mig.opnrid': 'mig.rid',
};
