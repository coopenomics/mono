/** История оплат кооператива (списания подписок из журнала биллинга) */
export * as GetCooperativePayments from './getCooperativePayments'

/** Реестр кооперативов оператора (список из блокчейна + данные провайдера) */
export * as GetCooperativesRegistry from './getCooperativesRegistry'

/** Получить текущий инстанс пользователя */
export * as GetCurrentInstance from './getCurrentInstance'

/** Получить статус установки кооператива с приватными данными */
export * as GetInstallationStatus from './getInstallationStatus'

/** Насколько узел кооператива отстал от цепи */
export * as GetNodeSyncState from './getNodeSyncState'

/** Получить подписки пользователя у провайдера */
export * as GetProviderSubscriptions from './getProviderSubscriptions'

/** Получить конфигурацию программ регистрации для кооператива */
export * as GetRegistrationConfig from './getRegistrationConfig'

/** Получить сводную публичную информацию о системе */
export * as GetSystemInfo from './getSystemInfo'

/** Последний устав кооператива со свежей ссылкой на скачивание */
export * as GetCooperativeCharter from './getCooperativeCharter'

/** Каталог витрины подключения: услуги и конфигурации сервера провайдера */
export * as GetProviderConnectionCatalog from './getProviderConnectionCatalog'
