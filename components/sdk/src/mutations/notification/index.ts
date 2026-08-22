/** Создать веб-пуш подписку для пользователя */
export * as CreateWebPushSubscription from './createWebPushSubscription'

/** Деактивировать веб-пуш подписку по ID */
export * as DeactivateWebPushSubscriptionById from './deactivateWebPushSubscriptionById'

/** Запустить воркфлоу уведомлений (только для председателя или server-secret) */
export * as TriggerNotificationWorkflow from './triggerNotificationWorkflow'

/** Переотправить уведомление (стол председателя) */
export * as ResendNotification from './resendNotification'

/** Отметить уведомление инбокса прочитанным */
export * as MarkNotificationRead from './markNotificationRead'

/** Отметить все уведомления инбокса прочитанными */
export * as MarkAllNotificationsRead from './markAllNotificationsRead'
