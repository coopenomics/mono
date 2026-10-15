// v5: курсор инжеста истории Matrix (/messages) + флаг завершения backfill — в chatcoop_managed_matrix_rooms.

import { MAIN_DATABASE, type MainDatabase as DataSource } from '@coopenomics/extension-kit';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';

export const chatcoopMessageHistoryIngestCursorV5Migration: IExtensionSchemaMigration<
  Record<string, unknown>,
  Record<string, unknown>
> = {
  extensionName: 'chatcoop',
  version: 5,

  migrate(oldConfig, defaultConfig) {
    return { ...defaultConfig, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const { logInfo } = ctx;
    const ds = ctx.resolve<DataSource>(MAIN_DATABASE);
    await ds.query(
      `ALTER TABLE chatcoop_managed_matrix_rooms ADD COLUMN IF NOT EXISTS message_history_pagination_token TEXT NULL`
    );
    await ds.query(
      `ALTER TABLE chatcoop_managed_matrix_rooms ADD COLUMN IF NOT EXISTS message_history_backfill_complete BOOLEAN NOT NULL DEFAULT false`
    );
    logInfo('[chatcoop schema v5] message_history_pagination_token, message_history_backfill_complete');
  },
};
