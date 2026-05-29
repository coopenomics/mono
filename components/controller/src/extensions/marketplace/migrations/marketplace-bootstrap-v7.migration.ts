import type { IExtensionSchemaMigration } from '~/domain/extension/services/extension-schema-migration.service';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v7 расширения `market` — изображения товара у Offer'а
 * (Story 3.2 доп.).
 *
 * Что добавляется:
 *  - колонка `marketplace_offer.images` (jsonb, default '[]') — массив снапшотов
 *    объектов bucket'а `stol-zakazov:images`: `{ bucket_key, content_hash,
 *    mime_type }`. TypeORM `synchronize:true` создаёт её `ADD COLUMN` с
 *    default-значением, backfill не нужен (существующие Offer'ы получают `[]`).
 *
 * Конфиг расширения не меняется — `migrate` тождественный (нужен только для
 * bump schema_version, как у v6).
 */
export const marketplaceBootstrapV7Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 7,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
