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
 * См. architecture.md §4.3.
 */
export type HashLocation = {
  code: string; // имя контракта (например "capital")
  table: string; // имя таблицы
  field: string; // имя поля внутри value.jsonb
};

export const PROCESS_HASH_LOCATOR: Record<string, HashLocation[]> = {
  'cap.debt': [{ code: 'capital', table: 'debts', field: 'debt_hash' }],
  // Акт 2 результат — два связанных process_type с ОДНИМ process_hash:
  //   * cap.act2shr — внесение результата в паевой фонд (Dr 04 / Cr 80)
  //   * cap.act2ln  — погашение выданного займа из стоимости результата
  // Оба должны отображаться рядом в UI для контроля, не сливаться в один.
  // Поэтому держим их как отдельные process_type, но оба ссылаются на общие
  // сущностные таблицы results/segments (source entity — один акт-2).
  'cap.act2shr': [
    { code: 'capital', table: 'results', field: 'result_hash' },
    { code: 'capital', table: 'segments', field: 'result_hash' },
  ],
  'cap.act2ln': [
    { code: 'capital', table: 'results', field: 'result_hash' },
    { code: 'capital', table: 'segments', field: 'result_hash' },
    { code: 'capital', table: 'debts', field: 'result_hash' },
  ],
  'cap.capimp': [{ code: 'capital', table: 'contributors', field: 'contributor_hash' }],
  'cap.act2prp': [{ code: 'capital', table: 'properties', field: 'property_hash' }],
  'wall.deposit': [{ code: 'wallet', table: 'deposits', field: 'deposit_hash' }],
  'wall.withdrw': [{ code: 'wallet', table: 'withdraws', field: 'withdraw_hash' }],
  'reg.regist': [{ code: 'registrator', table: 'regs', field: 'registration_hash' }],
  'mkt.offereq': [{ code: 'marketplace', table: 'requests', field: 'request_hash' }],
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
  // cap.act2shr и cap.act2ln — оба живут под одним process_hash (один акт-2),
  // но НЕ сливаются в один process_type: share-вклад и погашение займа — это
  // две разных бух-операции, которые пайщик/председатель должны видеть рядом.
  'cap.act2shr': 'cap.act2shr',
  'cap.act2ln': 'cap.act2ln',
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
