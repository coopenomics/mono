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
  'cap.act2res': [
    { code: 'capital', table: 'results', field: 'result_hash' },
    { code: 'capital', table: 'segments', field: 'result_hash' },
  ],
  'cap.capimp': [{ code: 'capital', table: 'contributors', field: 'contributor_hash' }],
  'cap.act2prp': [{ code: 'capital', table: 'properties', field: 'property_hash' }],
  'wall.deposit': [{ code: 'wallet', table: 'deposits', field: 'deposit_hash' }],
  'wall.withdrw': [{ code: 'wallet', table: 'withdraws', field: 'withdraw_hash' }],
  'reg.regist': [{ code: 'registrator', table: 'regs', field: 'registration_hash' }],
  'mkt.offereq': [{ code: 'marketplace', table: 'requests', field: 'request_hash' }],
  // sov.axncnv — одноактовый процесс: данные берутся из wjournal/journal +
  // документа statement (который детектируется DocumentFieldDetector).
  'sov.axncnv': [],
};

/**
 * Все известные process_type, зарегистрированные в локаторе.
 * Используется в fail-fast проверке: если пришёл неизвестный тип из wjournal,
 * локатор требует обновления.
 */
export const KNOWN_PROCESS_TYPES: ReadonlySet<string> = new Set(Object.keys(PROCESS_HASH_LOCATOR));
