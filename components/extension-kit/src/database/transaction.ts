import { AsyncLocalStorage } from 'node:async_hooks';
import type { Kysely } from 'kysely';

/** Изменение строки таблицы, о котором лента изменений узнаёт после фиксации записи. */
export interface PendingLocalChange {
  table: string;
  primary_key: string;
  row: Record<string, unknown>;
}

type Publisher = (change: PendingLocalChange) => void;

interface TransactionState {
  pending: AsyncLocalStorage<PendingLocalChange[]>;
  publish?: Publisher;
}

// Состояние одно на процесс, даже если пакет загружен двумя копиями: изменения
// копит слой базы ядра, а транзакцию открывает расширение.
const STATE_KEY = Symbol.for('Controller.Database.Transaction');
const globals = globalThis as unknown as Record<symbol, TransactionState | undefined>;
const state: TransactionState = (globals[STATE_KEY] ??= { pending: new AsyncLocalStorage<PendingLocalChange[]>() });

/** Изменения текущей транзакции: копятся здесь и публикуются после фиксации. */
export const pendingLocalChanges = state.pending;

/** Ядро сообщает, куда публиковать изменения после фиксации транзакции. */
export function configureLocalChangePublisher(publish: Publisher): void {
  state.publish = publish;
}

/**
 * Транзакция Kysely. Сигналы ленты изменений уходят после фиксации: стол по
 * ним читает уже записанное, откаченная запись сигнала не даёт. Голый
 * `db.transaction()` этого не делает — транзакции открывать только здесь.
 */
export async function inTransaction<TDatabase, TResult>(
  db: Kysely<TDatabase>,
  work: (trx: Kysely<TDatabase>) => Promise<TResult>
): Promise<TResult> {
  const changes: PendingLocalChange[] = [];
  const result = await state.pending.run(changes, () => db.transaction().execute((trx) => work(trx)));
  changes.forEach((change) => state.publish?.(change));
  return result;
}
