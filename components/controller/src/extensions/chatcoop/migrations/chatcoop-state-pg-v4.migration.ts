// Миграция схемы chatcoop v4: spaceId / секретарь / isInitialized → таблица chatcoop_state (переживает снос расширения).

import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import {
  CHATCOOP_STATE_REPOSITORY,
  type ChatcoopStateMergeInput,
  type ChatcoopStateRepository,
} from '../domain/repositories/chatcoop-state.repository';

const LEGACY_KEYS = [
  'spaceId',
  'isInitialized',
  'secretaryMatrixUserId',
  'secretaryInitialized',
  'secretaryUsername',
  'secretaryPassword',
  'secretaryPasswordEncrypted',
] as const;

function legacyToStateMerge(cfg: unknown): ChatcoopStateMergeInput {
  if (typeof cfg !== 'object' || cfg === null) {
    return {};
  }
  const c = cfg as Record<string, unknown>;
  const patch: ChatcoopStateMergeInput = {};

  if (typeof c.spaceId === 'string') {
    const t = c.spaceId.trim();
    if (t.length > 0) {
      patch.spaceId = t;
    }
  }

  if (c.isInitialized === true) {
    patch.isInitialized = true;
  } else if (c.isInitialized === false) {
    patch.isInitialized = false;
  }

  if (typeof c.secretaryMatrixUserId === 'string') {
    const t = c.secretaryMatrixUserId.trim();
    if (t.length > 0) {
      patch.secretaryMatrixUserId = t;
    }
  }

  if (typeof c.secretaryUsername === 'string') {
    const t = c.secretaryUsername.trim();
    if (t.length > 0) {
      patch.secretaryUsername = t;
    }
  }

  const enc =
    typeof c.secretaryPassword === 'string' && c.secretaryPassword.length > 0
      ? c.secretaryPassword
      : typeof c.secretaryPasswordEncrypted === 'string' && c.secretaryPasswordEncrypted.length > 0
        ? c.secretaryPasswordEncrypted
        : undefined;
  if (enc !== undefined) {
    patch.secretaryPasswordEncrypted = enc;
  }

  if (c.secretaryInitialized === true) {
    patch.secretaryInitialized = true;
  } else if (c.secretaryInitialized === false) {
    patch.secretaryInitialized = false;
  }

  if (
    patch.secretaryUsername &&
    patch.secretaryPasswordEncrypted &&
    patch.secretaryMatrixUserId &&
    patch.secretaryInitialized === undefined
  ) {
    patch.secretaryInitialized = true;
  }

  return patch;
}

export const chatcoopStatePgV4Migration: IExtensionSchemaMigration<Record<string, unknown>, Record<string, unknown>> = {
  extensionName: 'chatcoop',
  version: 4,

  migrate(oldConfig, defaultConfig) {
    const merged: Record<string, unknown> = { ...defaultConfig, ...oldConfig };
    for (const k of LEGACY_KEYS) {
      delete merged[k];
    }
    return merged;
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const { logInfo } = ctx;
    const extensionRepo = ctx.resolve<ExtensionDomainRepository<Record<string, unknown>>>(EXTENSION_REPOSITORY);
    const stateRepo = ctx.resolve<ChatcoopStateRepository>(CHATCOOP_STATE_REPOSITORY);

    const ext = await extensionRepo.findByName('chatcoop');
    const patch = legacyToStateMerge(ext?.config);
    const keys = Object.keys(patch) as (keyof ChatcoopStateMergeInput)[];
    if (keys.length === 0) {
      return;
    }
    await stateRepo.merge(patch);
    logInfo(`[chatcoop schema v4] Состояние перенесено в chatcoop_state (${keys.length} полей)`);
  },
};
