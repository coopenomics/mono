/**
 * Заглушки переменных окружения для прогонов, где реального стенда нет и не нужно:
 * генерация schema.gql и юнит-тесты.
 *
 * `config.ts` валидирует окружение прямо при импорте и на невалидном делает
 * `process.exit(1)`. Любой модуль, который тянет логгер или конфиг, роняет
 * процесс, если окружения нет. На машине разработчика его подставляет
 * `components/controller/.env`, поэтому проблема не видна; в CI `.env` нет и
 * быть не должно — там прогон падал целиком, не добравшись ни до одного теста.
 *
 * Значения заведомо нерабочие: соединений по ним никто не открывает, сервисы
 * в юнит-тестах и при генерации схемы подменяются заглушками. Смысл только в
 * том, чтобы Zod получил валидный объект.
 *
 * Держится отдельным модулем без побочных эффектов, чтобы `config.ts` и
 * jest-setup брали один и тот же список и он не разъезжался надвое.
 */
export const PLACEHOLDER_ENV_DEFAULTS: Record<string, string> = {
  NODE_ENV: 'development',
  BACKEND_URL: 'http://127.0.0.1:2998',
  FRONTEND_URL: 'http://127.0.0.1:2999',
  SERVER_SECRET: 'schema-gen-server-secret',
  MONGODB_URL: 'mongodb://127.0.0.1:27017/schema-gen',
  JWT_SECRET: 'schema-gen-jwt-secret-min-length-placeholder-32',
  POSTGRES_USERNAME: 'postgres',
  POSTGRES_PASSWORD: 'postgres',
  POSTGRES_DATABASE: 'postgres',
  REDIS_HOST: '127.0.0.1',
  REDIS_PASSWORD: '',
  BLOCKCHAIN_RPC: 'http://127.0.0.1:8888',
  CHAIN_ID: 'cf057bbfb72640471fd910bcb67639c22df9f238706fab5919ce743a1f9efa38',
  VAPID_PUBLIC_KEY: 'BM_schema_gen_placeholder_public_key____________________________',
  VAPID_PRIVATE_KEY: 'schema_gen_placeholder_private_key',
  MATRIX_ADMIN_USERNAME: 'schema-gen',
  MATRIX_ADMIN_PASSWORD: 'schema-gen',
};
