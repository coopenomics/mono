import type {
  IExtensionSchemaMigration,
  ExtensionSchemaMigrationAfterContext,
} from '~/domain/extension/services/extension-schema-migration.service';
import { defaultConfig, IConfig } from '../types';
import config from '~/config/config';
import {
  MARKETPLACE_VITRINE_REPOSITORY,
  type MarketplaceVitrineDomainRepository,
} from '../domain/repositories/marketplace-vitrine.repository';
import {
  MARKETPLACE_WHITELIST_REPOSITORY,
  type MarketplaceWhitelistDomainRepository,
} from '../domain/repositories/marketplace-whitelist.repository';

/**
 * Bootstrap-миграция v3 расширения `market` (Story 3.1).
 *
 * Конфиг (`IConfig`) не меняется — это исключительно data-bootstrap:
 *   1. создаёт дефолтную витрину `{id:'default', is_default:true,
 *      display_name:'Стол заказов'}` для текущего кооператива;
 *   2. добавляет в whitelist неудаляемую запись `{member_account=coopname,
 *      role:'auto-coop'}` — сам кооператив всегда может публиковать
 *      оферы для перепоставки собственных остатков (FR5).
 *
 * Идемпотентна: оба repository-вызова `ensureDefault`/`add` no-op'ят при
 * существующей записи. Миграция повторно безопасна.
 *
 * Внимание: таблицы `marketplace_vitrine`/`marketplace_whitelist`
 * создаются TypeORM-`synchronize:true` в `MarketplaceInfrastructureModule`
 * автоматически при старте — отдельный DDL не требуется.
 */
export const marketplaceBootstrapV3Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 3,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext) {
    const coopname = config.coopname;
    if (!coopname) {
      ctx.logWarn('[BOOTSTRAP_V3] config.coopname не задан — data-bootstrap пропущен');
      return;
    }

    try {
      const vitrineRepo = ctx.resolve<MarketplaceVitrineDomainRepository>(
        MARKETPLACE_VITRINE_REPOSITORY
      );
      const whitelistRepo = ctx.resolve<MarketplaceWhitelistDomainRepository>(
        MARKETPLACE_WHITELIST_REPOSITORY
      );

      const vitrine = await vitrineRepo.ensureDefault(coopname, 'Стол заказов');
      ctx.logInfo(
        `[BOOTSTRAP_V3] дефолтная витрина: id=${vitrine.id} coopname=${vitrine.coopname}`
      );

      const autoCoop = await whitelistRepo.add(coopname, coopname, 'auto-coop', null);
      ctx.logInfo(
        `[BOOTSTRAP_V3] auto-coop запись whitelist: id=${autoCoop.id} member=${autoCoop.member_account}`
      );
    } catch (error: unknown) {
      ctx.logError(
        '[BOOTSTRAP_V3] ошибка data-bootstrap (вероятно DI не зарегистрирован) — миграция повторится при следующем старте',
        error
      );
      throw error;
    }
  },
};
