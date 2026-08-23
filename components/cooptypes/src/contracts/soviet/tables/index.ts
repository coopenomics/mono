/**
 * Таблица хранит информацию о адресах кооператива.
 */
export * as Addresses from './addresses'

/**
 * Таблица содержит информацию о администраторах кооператива.
 */
export * as Admins from './admins'

/**
 * Таблица хранит очередь документов, которые ожидают автоматической подписи.
 */
export * as AutomationQueue from './automationQueue'

/**
 * Таблица хранит автоматизации для голосований и решений совета.
 */
export * as Automations from './automations'

/**
 * Таблица хранит информацию о советах кооператива.
 */
export * as Boards from './boards'

/**
 * Таблица содержит зарегистрированные пары заявлений на взнос и возврат взносов через смарт-контракт маркетплейса.
 */
export * as Changes from './changes'

/**
 * Таблица хранит информацию о решениях совета.
 */
export * as Decisions from './decisions'

/**
 * Таблица хранит заявления на вступление в кооператив, ожидающие рассмотрения в совете.
 */
export * as JoinCoops from './joinCoops'

/**
 * Таблица хранит целевые потребительские программы.
 */
export * as Programs from './programs'

/**
 * Таблица хранит информацию о пайщиках.
 */
export * as Participants from './participants'

/**
 * Таблица хранит информацию о балансах пайщиков в целевых потребительских программах кооператива.
 */
export * as ProgramWallets from './programWallets'

/**
 * Таблица содержит подписанные пайщиками документы соглашений с кооперативом
 */
export * as Agreements from './agreements'

/**
 * Таблица содержит реестр внутри-кооперативных соглашений/положений с пайщиками
 */
export * as CoopAgreements from './coopAgreements'

/**
 * Таблица содержит реестр внутри-кооперативных соглашений/положений с пайщиками v2
 */
export * as AgreementsLegacy from './agreements_legacy'

/**
 * Таблица хранит информацию о запросах утверждений от председателя.
 */
export * as Approvals from './approves'
export * as Taxes from './taxes'
