/**
 * Миграции схемы конфига расширения «Чат кооператива»: явный, упорядоченный список.
 *
 * Порядок здесь — порядок применения. Раньше он задавался двумя десятками
 * строк в модуле ядра, то есть ядро знало про версии чужих конфигов; теперь
 * DDL расширения едет вместе с самим расширением, как и его таблицы.
 */
import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';

import { chatcoopManagedMatrixRoomsV2Migration } from './migrations/chatcoop-managed-matrix-rooms-v2.migration';
import { chatcoopManagedMatrixRoomsV3Migration } from './migrations/chatcoop-managed-matrix-rooms-v3.migration';
import { chatcoopStatePgV4Migration } from './migrations/chatcoop-state-pg-v4.migration';
import { chatcoopMessageHistoryIngestCursorV5Migration } from './migrations/chatcoop-message-history-ingest-cursor-v5.migration';

export const chatcoopMigrations: IExtensionSchemaMigration[] = [
  chatcoopManagedMatrixRoomsV2Migration,
  chatcoopManagedMatrixRoomsV3Migration,
  chatcoopStatePgV4Migration,
  chatcoopMessageHistoryIngestCursorV5Migration,
];
