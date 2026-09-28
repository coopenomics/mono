import type {
  EntityMetadata,
  EntitySubscriberInterface,
  InsertEvent,
  QueryRunner,
  RemoveEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';

interface PendingChange {
  table: string;
  primary_key: string;
  row: Record<string, unknown> | undefined;
}

/** Публикация сигнала ленты изменений: таблица базы, ключ строки, строка. */
export type LocalChangePublisher = (table: string, primary_key: string, row: Record<string, unknown> | undefined) => unknown;

/**
 * Сигналы ленты изменений для данных узла вне цепи — общая часть подписчика
 * TypeORM для ядра и расширений со своей базой.
 *
 * Любая запись в наблюдаемую таблицу — через репозиторий, менеджер или
 * построитель запросов — порождает сигнал «перечитай». Сигнал уходит после
 * фиксации транзакции: стол по нему читает уже записанное, а откаченная запись
 * сигнала не даёт. Сырой `query()` подписчик не видит — такую запись
 * публикует сам её автор.
 *
 * Из `typeorm` здесь только типы: метаданные и события приходят от источника
 * данных вызывающей стороны.
 */
export class LocalChangesCollector implements EntitySubscriberInterface {
  private readonly pending = new WeakMap<QueryRunner, PendingChange[]>();

  constructor(
    private readonly isWatched: (table: string) => boolean,
    private readonly publish: LocalChangePublisher,
  ) {}

  afterInsert(event: InsertEvent<any>): void {
    this.collect(event.metadata, event.queryRunner, event.entity);
  }

  afterUpdate(event: UpdateEvent<any>): void {
    this.collect(event.metadata, event.queryRunner, { ...(event.databaseEntity ?? {}), ...(event.entity ?? {}) });
  }

  afterRemove(event: RemoveEvent<any>): void {
    const row = event.databaseEntity ?? event.entity;
    this.collect(event.metadata, event.queryRunner, row, event.entityId);
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    const changes = this.pending.get(event.queryRunner);
    if (!changes) return;
    this.pending.delete(event.queryRunner);
    changes.forEach((c) => void this.publish(c.table, c.primary_key, c.row));
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.pending.delete(event.queryRunner);
  }

  private collect(metadata: EntityMetadata, queryRunner: QueryRunner, row: Record<string, unknown> | undefined, entityId?: unknown): void {
    const table = metadata.tableName;
    if (!this.isWatched(table)) return;
    const change: PendingChange = { table, primary_key: primaryKeyOf(metadata, row, entityId), row };
    if (queryRunner?.isTransactionActive) {
      const list = this.pending.get(queryRunner) ?? [];
      list.push(change);
      this.pending.set(queryRunner, list);
      return;
    }
    // Вне транзакции запись уже зафиксирована — сигнал сразу.
    void this.publish(change.table, change.primary_key, change.row);
  }
}

/** Ключ строки; построитель запросов строку целиком не отдаёт — тогда пусто. */
function primaryKeyOf(metadata: EntityMetadata, row: Record<string, unknown> | undefined, entityId?: unknown): string {
  if (row) {
    const ids = metadata.primaryColumns.map((c) => c.getEntityValue(row)).filter((v) => v !== undefined && v !== null);
    if (ids.length) return ids.map(String).join(':');
  }
  if (entityId !== undefined && entityId !== null) {
    return typeof entityId === 'object' ? Object.values(entityId as object).map(String).join(':') : String(entityId);
  }
  return '';
}
