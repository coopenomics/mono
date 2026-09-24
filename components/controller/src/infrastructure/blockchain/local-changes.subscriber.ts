import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { LocalChangesCollector } from '@coopenomics/extension-kit';
import { ChainChangesService } from './chain-changes.service';

/**
 * Сигналы ленты изменений для данных узла вне цепи — основная база.
 *
 * Расширение объявляет свои таблицы базы (`declareLocalTables`), и любая
 * запись в них — через репозиторий, менеджер или построитель запросов —
 * порождает сигнал «перечитай» после фиксации транзакции. Так живое
 * обновление не зависит от того, не забыл ли кто-то вызвать публикацию после
 * очередного сохранения. Логика сбора — в `LocalChangesCollector`
 * (extension-kit): ей же пользуются расширения со своей базой.
 */
@Injectable()
export class LocalChangesSubscriber extends LocalChangesCollector {
  constructor(@InjectDataSource() dataSource: DataSource, feed: ChainChangesService) {
    super(
      (table) => Boolean(feed.localTableOf(table)),
      (table, primary_key, row) => feed.publishLocal(table, primary_key, row)
    );
    dataSource.subscribers.push(this);
  }
}
