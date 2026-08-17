/**
 * Отправка сообщений в Matrix (Client-Server API) от имени сервисной учётки.
 * Реализация — расширение ChatCoop; токен регистрируется в InnercoopBridgeModule.
 */
export interface InnerMatrixSendTextAndPinInput {
  /** Matrix room id (!xxx:domain) */
  matrixRoomId: string;
  /** Текст m.room.message (msgtype m.text) */
  plainTextBody: string;
}

/** Текстовое сообщение без закрепа (закрепы — только для документов и т.п.). */
export type InnerMatrixSendTextMessageInput = InnerMatrixSendTextAndPinInput;

/** Редактирование корневого сообщения (m.replace → исходный event_id). */
export interface InnerMatrixReplaceTextMessageInput {
  matrixRoomId: string;
  /** event_id исходного сообщения */
  rootEventId: string;
  plainTextBody: string;
}

/** Снятие закрепа и редaction корневого события (удаление анонса из мессенджера). */
export interface InnerMatrixUnpinAndRedactAnnouncementInput {
  matrixRoomId: string;
  rootEventId: string;
}

export interface IMatrixRoomMessagingPort {
  /**
   * Отправляет текстовое сообщение без закрепа.
   * @returns event_id отправленного сообщения
   */
  sendTextMessage(input: InnerMatrixSendTextMessageInput): Promise<string>;

  /**
   * Отправляет текстовое сообщение и добавляет его в закрепления комнаты (m.room.pinned_events).
   * Новое событие добавляется в начало списка; дубликаты event_id убираются.
   * @returns event_id отправленного сообщения
   */
  sendTextMessageAndPin(input: InnerMatrixSendTextAndPinInput): Promise<string>;

  /** Отправляет событие-замену (MSC2676) для обновления текста поста. */
  replaceTextMessage(input: InnerMatrixReplaceTextMessageInput): Promise<void>;

  /** Убирает event_id из m.room.pinned_events и выполняет redact события. */
  unpinAndRedactAnnouncement(input: InnerMatrixUnpinAndRedactAnnouncementInput): Promise<void>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────

/**
 * Matrix: отправка сообщений и закрепление. Провайдер — chatcoop.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const MATRIX_ROOM_MESSAGING_PORT = Symbol.for('Innercoop.CrossPlugin.MatrixRoomMessaging');
