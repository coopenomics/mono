/**
 * Регистрация нового пакета в каталоге.
 */
export * as Regpackage from './regpackage'

/**
 * Передача владения пакетом другому аккаунту.
 */
export * as Transferpkg from './transferpkg'

/**
 * Публикация нового релиза с атомарным supersede предыдущего active в том же scope
 * и inline TTL-cleanup просроченных superseded.
 */
export * as Setrelease from './setrelease'

/**
 * Откат на предыдущую версию из окна retention (FR43).
 */
export * as Reactivate from './reactivate'

/**
 * Отзыв релиза (CVE / нарушение). Withdrawn записи не подпадают под TTL.
 */
export * as Withdraw from './withdraw'

/**
 * Ручная очистка просроченных superseded-записей (TTL 90 дней).
 * Доброкачественная операция — без авторизации.
 */
export * as Cleanup from './cleanup'

/**
 * Регистрация / продление подписки кооператива на пакет (idempotent по subscriber+package_id).
 */
export * as Regsub from './regsub'

/**
 * Деактивация подписки (active=false). Row не удаляется — нужен для аудита.
 */
export * as Expsub from './expsub'

/**
 * Первичная регистрация кооператива в каталоге.
 */
export * as Regcoop from './regcoop'

/**
 * Обновление полей кооператива, включая ротацию subnet-signing-key.
 */
export * as Setcoop from './setcoop'

/**
 * Пустышка для CDT-апгрейдов.
 * @private
 */
export * as Migrate from './migrate'
