import type {
  IExtensionSchemaMigration,
  ExtensionSchemaMigrationAfterContext,
} from '~/domain/extension/services/extension-schema-migration.service';
import { defaultConfig, IConfig } from '../types';
import {
  MARKETPLACE_CATEGORY_REPOSITORY,
  type MarketplaceCategoryDomainRepository,
} from '../domain/repositories/marketplace-category.repository';

/**
 * Bootstrap-миграция v4 расширения `market` (Story 3.2).
 *
 * Идемпотентный data-bootstrap: сидирует 9 baseline-категорий
 * (8 продовольственных + «Прочее») Стола заказов (`marketplace_category`
 * table). Конфиг не меняется — категории живут в собственной таблице.
 *
 * DDL `marketplace_category` создаётся TypeORM `synchronize:true`.
 */
export const marketplaceBootstrapV4Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 4,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext) {
    try {
      const categoryRepo = ctx.resolve<MarketplaceCategoryDomainRepository>(
        MARKETPLACE_CATEGORY_REPOSITORY
      );
      await categoryRepo.upsertBaseline();
      ctx.logInfo('[BOOTSTRAP_V4] 9 baseline-категорий marketplace upsert-нуты');
    } catch (error: unknown) {
      ctx.logError('[BOOTSTRAP_V4] ошибка upsert категорий — миграция повторится при следующем старте', error);
      throw error;
    }
  },
};
