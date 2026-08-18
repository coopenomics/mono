// Миграция схемы chatcoop v3: убрать membersRoomId/councilRoomId из JSON-конфига; в afterMigrate — только перенос комнаты совета в реестр PG (legacy councilRoomId из БД до update).

import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import {
  CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY,
  type ChatcoopManagedMatrixRoomRepository,
} from '../domain/repositories/managed-matrix-room.repository';
import { COUNCIL_ROOM_MATRIX } from '../application/config/matrix-council-room.config';

function readLegacyCouncilRoomId(cfg: unknown): string | undefined {
  if (typeof cfg !== 'object' || cfg === null) {
    return undefined;
  }
  const c = cfg as Record<string, unknown>;
  if (typeof c.councilRoomId !== 'string') {
    return undefined;
  }
  const t = c.councilRoomId.trim();
  return t.length > 0 ? t : undefined;
}

export const chatcoopManagedMatrixRoomsV3Migration: IExtensionSchemaMigration<
  Record<string, unknown>,
  Record<string, unknown>
> = {
  extensionName: 'chatcoop',
  version: 3,

  migrate(oldConfig, defaultConfig) {
    const merged: Record<string, unknown> = { ...defaultConfig, ...oldConfig };
    delete merged.membersRoomId;
    delete merged.councilRoomId;
    return merged;
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const { logInfo } = ctx;
    const extensionRepo = ctx.resolve<ExtensionDomainRepository<Record<string, unknown>>>(EXTENSION_REPOSITORY);
    const managedRooms = ctx.resolve<ChatcoopManagedMatrixRoomRepository>(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY);

    const ext = await extensionRepo.findByName('chatcoop');
    const councilId = readLegacyCouncilRoomId(ext?.config);
    if (!councilId) {
      return;
    }

    await managedRooms.upsertRoom({
      matrixRoomId: councilId,
      encrypted: COUNCIL_ROOM_MATRIX.encrypt,
      kind: 'council',
      displayLabel: 'Комната совета',
      projectHash: null,
    });
    logInfo('[chatcoop schema v3] Реестр: комната совета перенесена из legacy-конфига');
  },
};
