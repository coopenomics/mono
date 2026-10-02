/**
 * Версия запущенного клиента — запекается в бандл при сборке из package.json
 * (CalVer, lockstep через lerna; quasar.config.cjs → process.env.APP_VERSION).
 * `dev` — сборка без версии (локальная разработка).
 */
export const APP_VERSION = (process.env.APP_VERSION as string) || 'dev';
