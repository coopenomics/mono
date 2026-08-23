/** Установить расширение */
export * as InstallExtension from './installExtension'
/** Удалить расширение */
export * as UninstallExtension from './uninstallExtension'
/** Обновить расширение */
export * as UpdateExtension from './updateExtension'
/** Зарегистрировать пакет в apps-catalog от имени chairman'а (Story 9.3.b-pub) */
export * as PublishPackage from './publishPackage'
/** Опубликовать релиз пакета с manifest'ом (Story 9.3.b-rel) */
export * as PublishRelease from './publishRelease'
/** Активировать подписку кооператива на пакет каталога (Story 9.3.b-sub) */
export * as SubscribePackage from './subscribePackage'
/** Approve заявки на модерацию — операторский стол ВОСХОДА (Story 9.9) */
export * as ApproveModeration from './approveModeration'
/** Reject заявки на модерацию с причиной (Story 9.9) */
export * as RejectModeration from './rejectModeration'
export * as CreatePublisherToken from './createPublisherToken'
export * as RevokePublisherToken from './revokePublisherToken'
