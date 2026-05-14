/**
 * Правила детекции документных полей в дельтах.
 *
 * Используется сервисом `ProcessRegistryService` в phase C для выделения
 * подписанных документов из дельт и их раскрытия через `DocumentAggregator`.
 * Документы попадают в `ProcessView.documents[]`, при этом сырое значение
 * поля в `delta_history` остаётся как есть — это нужно для трассируемости
 * подписей во времени.
 *
 * Если поле добавили в какой-то ончейн-таблице, но забыли прописать
 * здесь — работает fallback-эвристика в сервисе: value с полями
 * `{version, doc_hash, signatures}` детектируется как подписанный документ.
 *
 * См. architecture.md §4.4.
 */
export type DocumentField = {
  code: string; // имя контракта
  table: string; // имя таблицы
  field: string; // имя jsonb-поля с подписанным документом
};

export const DOCUMENT_FIELDS: DocumentField[] = [
  // soviet
  { code: 'soviet', table: 'agreements', field: 'document' },
  { code: 'soviet', table: 'decisions', field: 'document' },

  // capital
  { code: 'capital', table: 'contributors', field: 'contract' },
  { code: 'capital', table: 'contributors', field: 'statement' },
  { code: 'capital', table: 'results', field: 'statement' },
  { code: 'capital', table: 'results', field: 'act' },
  { code: 'capital', table: 'debts', field: 'authorization' },
  { code: 'capital', table: 'debts', field: 'statement' },
  { code: 'capital', table: 'properties', field: 'statement' },
  { code: 'capital', table: 'properties', field: 'act' },

  // registrator
  { code: 'registrator', table: 'regs', field: 'statement' },
  { code: 'registrator', table: 'regs', field: 'authorization' },

  // wallet
  { code: 'wallet', table: 'deposits', field: 'statement' },
  { code: 'wallet', table: 'withdraws', field: 'statement' },

  // marketplace
  { code: 'marketplace', table: 'requests', field: 'statement' },
];

/**
 * Эвристика: значение похоже на подписанный документ (version/doc_hash/signatures).
 * Fallback на случай, если таблицу/поле забыли внести в DOCUMENT_FIELDS.
 */
export function looksLikeSignedDocument(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.doc_hash === 'string' &&
    Array.isArray(v.signatures) &&
    (typeof v.hash === 'string' || typeof v.version === 'string' || typeof v.version === 'number')
  );
}
