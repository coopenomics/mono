import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Уведомление личного инбокса пайщика (строка notification_inbox, канал In-app)
const rawInboxNotificationSelector = {
  id: true,
  workflowId: true,
  title: true,
  body: true,
  payload: true,
  actorSubscriberId: true,
  isRead: true,
  readAt: true,
  createdAt: true,
}

const _validateInbox: MakeAllFieldsRequired<ValueTypes['InboxNotification']> = rawInboxNotificationSelector

export type inboxNotificationModel = ModelTypes['InboxNotification']
export const inboxNotificationSelector = Selector('InboxNotification')(rawInboxNotificationSelector)

// Счётчик непрочитанных (бейдж колокола)
const rawUnreadNotificationsCountSelector = {
  count: true,
}

const _validateCount: MakeAllFieldsRequired<ValueTypes['UnreadNotificationsCount']> = rawUnreadNotificationsCountSelector

export type unreadNotificationsCountModel = ModelTypes['UnreadNotificationsCount']
export const unreadNotificationsCountSelector = Selector('UnreadNotificationsCount')(rawUnreadNotificationsCountSelector)

// Пагинированная лента инбокса
export const rawInboxNotificationPaginationSelector = { ...paginationSelector, items: rawInboxNotificationSelector }

const _validatePagination: MakeAllFieldsRequired<ValueTypes['InboxNotificationPaginationResult']> =
  rawInboxNotificationPaginationSelector

export type inboxNotificationPaginationModel = ModelTypes['InboxNotificationPaginationResult']
export const inboxNotificationPaginationSelector = Selector('InboxNotificationPaginationResult')(
  rawInboxNotificationPaginationSelector
)

export { rawInboxNotificationSelector, rawUnreadNotificationsCountSelector }
