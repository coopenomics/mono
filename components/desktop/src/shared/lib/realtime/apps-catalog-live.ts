import type { ChainTableRef } from './live-reload';

/**
 * Таблицы ленты узла для экранов приложений каталога (487-37). Объявляет их
 * расширение каталога в ядре (`DeveloperLiveFeedService`): назначения
 * издателей и согласия на права — таблицы базы узла, пакеты, ключи API и
 * очередь модерации — данные каталога, сигнал по ним ядро шлёт после своей
 * мутации и по опросу каталога.
 */
const CODE = 'developer';

export const APPS_CATALOG_LIVE = {
  publishers: { code: CODE, table: 'apps_publishers' },
  rightsConsents: { code: CODE, table: 'apps_rights_consents' },
  packages: { code: CODE, table: 'apps_catalog_packages' },
  keys: { code: CODE, table: 'apps_publisher_keys' },
  moderation: { code: CODE, table: 'apps_catalog_moderation' },
} as const satisfies Record<string, ChainTableRef>;
