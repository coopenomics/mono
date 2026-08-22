/**
 * Оповещения пайщиков о событиях кооперативного календаря (Novu / стол связи).
 * Реализация — ChatcoopCalendarEventNotificationService; токен COOP_CALENDAR_EVENT_NOTIFICATION_PORT в ChatCoopPluginModule.
 */
/** Совпадает с ChatcoopManagedMatrixRoomKind в реестре управляемых комнат. */
export type InnerCoopCalendarNotificationRoomKind = 'members' | 'council' | 'capital_project' | 'secretary';

export interface InnerCoopCalendarEventNotificationInput {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  roomDisplayLabel: string;
  eventUrl: string;
  /** Имя пользователя, создавшего или изменившего событие */
  actorUsername: string;
  /** Тип комнаты из реестра; рассылка по допуску только при capital_project + projectHash. */
  roomKind: InnerCoopCalendarNotificationRoomKind;
  /** Для kind === capital_project; иначе null */
  projectHash: string | null;
}

export interface ICoopCalendarEventNotificationPort {
  notifyEventCreated(input: InnerCoopCalendarEventNotificationInput): Promise<void>;

  notifyEventUpdated(input: InnerCoopCalendarEventNotificationInput): Promise<void>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────

/**
 * Оповещения о создании/изменении событий календаря. Провайдер — chatcoop.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const COOP_CALENDAR_EVENT_NOTIFICATION_PORT = Symbol.for('Innercoop.CrossPlugin.CoopCalendarEventNotification');
