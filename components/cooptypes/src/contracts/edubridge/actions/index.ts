// Actions контракта edubridge (E3, «Образовательный мост»).
// Источник правды: components/contracts/build/contracts/edubridge/edubridge.abi

// ── p.edu.access (подписка и конвертация) ────────────────────────────────

/**
 * Конвертация паевого взноса в членский кошелёк «Образования»: o.edu.conv.
 */
export * as Convert from './convert'

/**
 * Открытие подписки на курс.
 */
export * as Opensub from './opensub'

/**
 * Продление подписки.
 */
export * as Extendsub from './extendsub'

/**
 * Истечение подписки (erase).
 */
export * as Expiresub from './expiresub'

// ── p.edu.rid (взнос РИД) ────────────────────────────────────────────────

/**
 * Заявление преподавателя о взносе РИД.
 */
export * as Submitrid from './submitrid'

/**
 * Приём РИД по решению совета и акту: o.edu.rid.
 */
export * as Acceptrid from './acceptrid'

/**
 * Отказ в приёме РИД по решению совета.
 */
export * as Declinerid from './declinerid'
