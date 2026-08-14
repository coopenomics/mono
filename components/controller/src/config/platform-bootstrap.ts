/**
 * Предусловие графа модулей: настройки контура и секрет межсервисного обхода
 * передаются в `@coopenomics/extension-kit` до того, как загрузится хоть одно
 * расширение.
 *
 * Модуль сделан отдельным и импортируется первой строкой `app.module.ts`
 * намеренно. Импорты выполняются в порядке записи, а расширение читает
 * настройки уже при построении своей схемы конфига — на уровне модуля, а не в
 * рантайме: символ системного токена входит в дефолты и в подписи полей формы.
 * Вызов, стоящий ниже по файлу или в `index.ts`, к этому моменту ещё не
 * произошёл бы, и расширение получило бы исключение о незаданных настройках.
 *
 * Точек входа в граф несколько — приложение, генератор схемы, миграции,
 * тесты, — и каждая обязана получить настройки одинаково. Поэтому предусловие
 * висит на самом графе, а не на конкретном запуске.
 */
import { configureExtensionAuth, configurePlatformSettings } from '@coopenomics/extension-kit';
import config from './config';

/**
 * Передать каркасу настройки контура. Вызывается при импорте этого файла, а
 * отдельно — из точек входа, которые поднимают модули сами: генератора схемы и
 * тестов, сбрасывающих реестр модулей. Повторный вызов безвреден: настройки
 * перезаписываются теми же значениями.
 */
export function applyPlatformBootstrap(): void {
  configureExtensionAuth({ serverSecret: config.server_secret });

  configurePlatformSettings({
    coopname: config.coopname,
    frontendUrl: config.frontend_url,
    backendUrl: config.backend_url,
    timezone: config.timezone,
    environment: config.env,
    blockchain: {
      rootGovernSymbol: config.blockchain.root_govern_symbol,
      rootGovernPrecision: config.blockchain.root_govern_precision,
      rootSymbol: config.blockchain.root_symbol,
      rootPrecision: config.blockchain.root_precision,
      postTransactChainReadDelayMs: config.blockchain.post_transact_chain_read_delay_ms,
      chainId: config.blockchain.id,
    },
  });
}

applyPlatformBootstrap();
