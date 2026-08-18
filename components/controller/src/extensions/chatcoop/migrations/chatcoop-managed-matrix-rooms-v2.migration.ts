// Миграция схемы chatcoop v2: заполнение реестра Matrix-комнат проектов Capital из таблицы capital_projects (members/council не мигрируем — комната пайщиков создаётся при отсутствии в реестре на старте расширения; совет — в v3).

import { DataSource } from 'typeorm';
import type {
  IExtensionSchemaMigration,
  ExtensionSchemaMigrationAfterContext,
} from '@coopenomics/extension-kit';
import {
  CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY,
  type ChatcoopManagedMatrixRoomRepository,
} from '../domain/repositories/managed-matrix-room.repository';

async function backfillCapitalProjectRooms(
  ctx: ExtensionSchemaMigrationAfterContext,
  managedRooms: ChatcoopManagedMatrixRoomRepository
): Promise<void> {
  const { logInfo, logWarn } = ctx;

  let projectRows: { project_hash: string; title: string; matrix_room_id: string }[] = [];
  try {
    const ds = ctx.resolve<DataSource>(DataSource);
    projectRows = (await ds.query(
      `SELECT project_hash, title, matrix_room_id FROM capital_projects WHERE matrix_room_id IS NOT NULL AND matrix_room_id <> ''`
    )) as { project_hash: string; title: string; matrix_room_id: string }[];
  } catch (e) {
    logWarn(`[chatcoop schema v2] Таблица capital_projects недоступна: ${String(e)}`);
  }

  for (const pr of projectRows) {
    const label = (pr.title || pr.project_hash).slice(0, 500);
    await managedRooms.upsertRoom({
      matrixRoomId: pr.matrix_room_id,
      encrypted: false,
      kind: 'capital_project',
      displayLabel: label,
      projectHash: pr.project_hash,
    });
  }
  logInfo(`[chatcoop schema v2] Реестр: комнаты проектов Capital — ${projectRows.length} записей`);
}

/**
 * v2: перенос комнат проектов Capital в chatcoop_managed_matrix_rooms. Конфиг JSON не меняется.
 */
export const chatcoopManagedMatrixRoomsV2Migration: IExtensionSchemaMigration<
  Record<string, unknown>,
  Record<string, unknown>
> = {
  extensionName: 'chatcoop',
  version: 2,

  migrate(oldConfig, defaultConfig) {
    return { ...defaultConfig, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const managedRooms = ctx.resolve<ChatcoopManagedMatrixRoomRepository>(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY);
    await backfillCapitalProjectRooms(ctx, managedRooms);
  },
};
