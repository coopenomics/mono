import type {
  IExtensionSchemaMigration,
  ExtensionSchemaMigrationAfterContext,
} from '@coopenomics/extension-kit';
import { IConfig } from '../types';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_VITRINE_REPOSITORY,
  type MarketplaceVitrineDomainRepository,
} from '../domain/repositories/marketplace-vitrine.repository';

/**
 * Bootstrap-миграция v3 расширения `market`.
 *
 * Конфиг (`IConfig`) не меняется — это исключительно data-bootstrap: создаёт
 * дефолтную витрину `{id:'default', is_default:true, display_name:'Стол
 * заказов'}` для текущего кооператива.
 *
 * Реестр поставщиков (бывший whitelist) bootstrap'ом не наполняется: сам
 * кооператив получает право публиковать перепоставку остатков (FR5) по
 * правилу `member === coopname` в `isOfferer`, отдельная запись не нужна.
 *
 * Идемпотентна: `ensureDefault` no-op'ит при существующей записи.
 *
 * Внимание: таблицы `marketplace_vitrine`/`marketplace_supplier` создаются
 * TypeORM-`synchronize:true` в `MarketplaceInfrastructureModule` автоматически
 * при старте — отдельный DDL не требуется.
 */
export const marketplaceBootstrapV3Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 3,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext) {
    const coopname = platformSettings().coopname;
    if (!coopname) {
      ctx.logWarn('[BOOTSTRAP_V3] platformSettings().coopname не задан — data-bootstrap пропущен');
      return;
    }

    try {
      const vitrineRepo = ctx.resolve<MarketplaceVitrineDomainRepository>(
        MARKETPLACE_VITRINE_REPOSITORY
      );

      const vitrine = await vitrineRepo.ensureDefault(coopname, 'Стол заказов');
      ctx.logInfo(
        `[BOOTSTRAP_V3] дефолтная витрина: id=${vitrine.id} coopname=${vitrine.coopname}`
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
