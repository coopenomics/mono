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
 * Списание членского взноса в фонд программы: o.edu.fee.
 */
export * as Chargefee from './chargefee'

/**
 * Отмена подписки с возвратом членского взноса.
 */
export * as Cancelsub from './cancelsub'

/**
 * Возврат остатка кошелька программы в паевой взнос.
 */
export * as Retshare from './retshare'

/**
 * Продление подписки.
 */
export * as Extendsub from './extendsub'

/**
 * Истечение подписки (erase).
 */
export * as Expiresub from './expiresub'

// ── p.edu.spend (расходы программы) ──────────────────────────────────────

/**
 * Подача расхода программы в шасси расходов: o.edu.expfnd.
 */
export * as CreateExp from './createExp'

// ── p.edu.rid (взнос РИД) ────────────────────────────────────────────────

/**
 * Приём материалов занятия на ответственное хранение: o.edu.hold.
 */
export * as Holdrid from './holdrid'

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

/**
 * Снятие материалов с ответственного хранения по рекламации: o.edu.retrid.
 */
export * as Recallrid from './recallrid'

// ── p.edu.teach (договор УХД и приложения через одобрение председателя) ──

/**
 * Преподаватель подписывает договор УХД — первая подпись.
 */
export * as Signcontract from './signcontract'

/**
 * Председатель подписал договор — коллбэк совета, договор действует.
 */
export * as Apprvcontr from './apprvcontr'

/**
 * Председатель отказал в подписи договора — коллбэк совета.
 */
/** Резерв выплат преподавателям: выделение из собранного взноса и высвобождение при отмене. */
export * as Allotfee from './allotfee'
export * as Freereserve from './freereserve'

/** Публикация заявления о взносе, покрытом кошельком программы целиком. */
export * as Regstatement from './regstatement'

export * as Dclinecontr from './dclinecontr'

/** Прекращение договора УХД — при выходе преподавателя либо по соглашению сторон. */
export * as Termcontract from './termcontract'

/**
 * Преподаватель подписывает приложение к договору на курс — первая подпись.
 */
export * as Signannex from './signannex'

/**
 * Председатель подписал приложение — коллбэк совета.
 */
export * as Apprvannex from './apprvannex'

/**
 * Председатель отказал в подписи приложения — коллбэк совета.
 */
export * as Dclineannex from './dclineannex'
