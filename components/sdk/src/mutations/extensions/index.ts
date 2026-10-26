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
/** Оформить подписку кооператива на приложение каталога у провайдера подключения */
export * as SubscribePackage from './subscribePackage'
/** Отменить подписку кооператива на приложение каталога */
export * as UnsubscribePackage from './unsubscribePackage'
/** Включить или выключить приложение каталога на рабочем столе */
export * as SetCatalogAppEnabled from './setCatalogAppEnabled'
/** Approve заявки на модерацию — операторский стол ВОСХОДА (Story 9.9) */
export * as ApproveModeration from './approveModeration'
/** Reject заявки на модерацию с причиной (Story 9.9) */
export * as RejectModeration from './rejectModeration'
export * as AddAppsPublisher from './addAppsPublisher'
export * as RemoveAppsPublisher from './removeAppsPublisher'
export * as IssueMyPublisherToken from './issueMyPublisherToken'
export * as RevokeMyPublisherToken from './revokeMyPublisherToken'
