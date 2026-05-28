/**
 * Оповещения пайщиков о событиях кооперативного календаря (Novu / стол связи).
 * Реализация — ChatcoopCalendarEventNotificationService; токен INTER_COOP_CALENDAR_EVENT_NOTIFICATION в ChatCoopPluginModule.
 */
/** Совпадает с ChatcoopManagedMatrixRoomKind в реестре управляемых комнат. */
export type InterCoopCalendarNotificationRoomKind = 'members' | 'council' | 'capital_project' | 'secretary';

export interface InterCoopCalendarEventNotificationInput {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  roomDisplayLabel: string;
  eventUrl: string;
  /** Имя пользователя, создавшего или изменившего событие */
  actorUsername: string;
  /** Тип комнаты из реестра; рассылка по допуску только при capital_project + projectHash. */
  roomKind: InterCoopCalendarNotificationRoomKind;
  /** Для kind === capital_project; иначе null */
  projectHash: string | null;
}

export interface InterCoopCalendarEventNotificationPort {
  notifyEventCreated(input: InterCoopCalendarEventNotificationInput): Promise<void>;

  notifyEventUpdated(input: InterCoopCalendarEventNotificationInput): Promise<void>;
}
