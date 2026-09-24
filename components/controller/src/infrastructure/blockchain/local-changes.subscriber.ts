import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntityMetadata,
  EntitySubscriberInterface,
  InsertEvent,
  QueryRunner,
  RemoveEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';
import { ChainChangesService } from './chain-changes.service';

interface PendingChange {
  table: string;
  primary_key: string;
  row: Record<string, unknown> | undefined;
}

/**
 * Сигналы ленты изменений для данных узла вне цепи.
 *
 * Расширение объявляет свои таблицы базы (`declareLocalTables`), и любая
 * запись в них — через репозиторий, менеджер или построитель запросов —
 * порождает сигнал «перечитай». Сигнал уходит после фиксации транзакции:
 * стол по нему читает уже записанное, а откаченная запись сигнала не даёт.
 * Так живое обновление не зависит от того, не забыл ли кто-то вызвать
 * публикацию после очередного сохранения.
 */
@Injectable()
export class LocalChangesSubscriber implements EntitySubscriberInterface {
  private readonly pending = new WeakMap<QueryRunner, PendingChange[]>();

  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly feed: ChainChangesService
  ) {
    dataSource.subscribers.push(this);
  }

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
    changes.forEach((c) => void this.feed.publishLocal(c.table, c.primary_key, c.row));
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.pending.delete(event.queryRunner);
  }

  private collect(metadata: EntityMetadata, queryRunner: QueryRunner, row: Record<string, unknown> | undefined, entityId?: unknown): void {
    const table = metadata.tableName;
    if (!this.feed.localTableOf(table)) return;
    const change: PendingChange = { table, primary_key: primaryKeyOf(metadata, row, entityId), row };
    if (queryRunner?.isTransactionActive) {
      const list = this.pending.get(queryRunner) ?? [];
      list.push(change);
      this.pending.set(queryRunner, list);
      return;
    }
    // Вне транзакции запись уже зафиксирована — сигнал сразу.
    void this.feed.publishLocal(change.table, change.primary_key, change.row);
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
