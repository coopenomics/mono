import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Попытка доставки уведомления (строка журнала notification_deliveries)
const rawNotificationAttemptSelector = {
  id: true,
  attemptNumber: true,
  status: true,
  providerResponse: true,
  error: true,
  createdAt: true,
}

const _validateAttempt: MakeAllFieldsRequired<ValueTypes['NotificationAttempt']> = rawNotificationAttemptSelector

export const notificationAttemptSelector = Selector('NotificationAttempt')(rawNotificationAttemptSelector)

// Уведомление в журнале (строка очереди notification_outbox)
const rawNotificationSelector = {
  id: true,
  coopname: true,
  workflowId: true,
  channel: true,
  recipientSubscriberId: true,
  recipientUsername: true,
  status: true,
  attempts: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
}

const _validateNotification: MakeAllFieldsRequired<ValueTypes['Notification']> = rawNotificationSelector

export type notificationModel = ModelTypes['Notification']
export const notificationSelector = Selector('Notification')(rawNotificationSelector)

// Детализация уведомления с историей попыток по каналу
const rawNotificationDetailSelector = {
  ...rawNotificationSelector,
  deliveries: rawNotificationAttemptSelector,
}

const _validateDetail: MakeAllFieldsRequired<ValueTypes['NotificationDetail']> = rawNotificationDetailSelector

export type notificationDetailModel = ModelTypes['NotificationDetail']
export const notificationDetailSelector = Selector('NotificationDetail')(rawNotificationDetailSelector)

// Пагинированный журнал уведомлений
export const rawNotificationPaginationSelector = { ...paginationSelector, items: rawNotificationSelector }

const _validatePagination: MakeAllFieldsRequired<ValueTypes['NotificationPaginationResult']> = rawNotificationPaginationSelector

export type notificationPaginationModel = ModelTypes['NotificationPaginationResult']
export const notificationPaginationSelector = Selector('NotificationPaginationResult')(rawNotificationPaginationSelector)

export { rawNotificationAttemptSelector, rawNotificationSelector, rawNotificationDetailSelector }
