/**
 * jest setupFiles — выполняется ДО импорта тестового модуля, а значит до того,
 * как какой-нибудь спек потянет `~/config`.
 *
 * Зачем. `src/config/config.ts` валидирует окружение прямо при импорте и на
 * невалидном зовёт `process.exit(1)`. Спеки, лежащие рядом с кодом в `src/`,
 * импортируют реальные сервисы, те тянут логгер, логгер — конфиг, и весь
 * прогон умирает с «process.exit called with 1», не показав ни одного теста.
 * Локально это незаметно: `components/controller/.env` подставляет всё нужное.
 * В CI `.env` нет, и первый же такой спек ронял релизный гейт.
 *
 * Заполняем только отсутствующие переменные: реальное окружение, если оно
 * задано, имеет приоритет и ничего здесь не перетирается.
 */
import { PLACEHOLDER_ENV_DEFAULTS } from '../src/config/placeholder-env';

for (const [key, value] of Object.entries(PLACEHOLDER_ENV_DEFAULTS)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// Тесты — всегда test-окружение, даже если заглушка выше подставила development.
process.env.NODE_ENV = 'test';

/**
 * Настройки контура для каркаса расширений — то же, что делает composition root
 * в `src/index.ts` при старте приложения.
 *
 * Зачем здесь. Утилиты каркаса (`QuantityUtils`, `AssetUtils`, форматирование
 * сумм) берут символ и точность токена из `platformSettings()`, а не из
 * `~/config`: за пределами монолита конфига ядра нет. Без настройки первый же
 * разбор суммы в спеке падает с «Настройки контура не заданы». Импорт лениво
 * внутри — до заполнения `process.env` выше конфиг не поднять.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configurePlatformSettings } = require('@coopenomics/extension-kit');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../src/config/config').default;

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
