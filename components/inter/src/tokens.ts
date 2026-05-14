/**
 * Nest DI: реализацию подставляет composition root (ExtensionsModule).
 */
export const INTER_PROJECT_COMMUNICATION_ARTIFACTS = Symbol.for(
  'InterProjectCommunicationArtifacts'
);

/** Matrix: отправка сообщений (и опционально закрепления) через ChatCoop / MatrixApiService. */
export const INTER_MATRIX_ROOM_MESSAGING = Symbol.for('InterMatrixRoomMessaging');

/** ChatCoop: чтение событий календаря для Capital и др. */
export const INTER_CHATCOOP_CALENDAR = Symbol.for('InterChatCoopCalendar');

/** ChatCoop: Novu-уведомления о создании/изменении событий календаря кооператива. */
export const INTER_COOP_CALENDAR_EVENT_NOTIFICATION = Symbol.for('InterCoopCalendarEventNotification');

/** Capital: username с подтверждённым допуском к проекту (appendix confirmed). */
export const INTER_PROJECT_CAPITAL_CLEARANCE = Symbol.for('InterProjectCapitalClearance');

/** FileStorage: универсальное файловое хранилище контура кооператива (MinIO в v1, S3 в v2). */
export const INTER_FILE_STORAGE = Symbol.for('InterFileStorage');
