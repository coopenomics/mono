/**
 * Сообщения Matrix в истории (текст и расшифрованное аудио).
 * Календарные сутки UTC: YYYY-MM-DD.
 */
export type InnerRoomMessageKind = 'text' | 'audio';

export interface InnerRoomMessageLine {
  originServerTs: number;
  authorLabel: string;
  coopUsername: string | null;
  kind: InnerRoomMessageKind;
  bodyText: string;
}

export interface InnerCompletedCallTranscriptionHead {
  id: string;
  matrixRoomId: string;
  roomName: string;
  startedAt: Date;
  endedAt: Date | null;
}

/** Комната проекта Capital в реестре ChatCoop (kind capital_project). */
export interface InnerProjectCommunicationRoomRef {
  matrixRoomId: string;
  displayLabel: string;
}

/** Тип непроектной комнаты ChatCoop, синхронизируемой в blago отдельной верхней папкой. */
export type InnerNonProjectRoomKind = 'members' | 'council' | 'secretary';

/** Комната ChatCoop вне проекта Capital (пайщики/совет/секретарь) — для синхронизации переписки и транскрипций в blago. */
export interface InnerNonProjectCommunicationRoomRef {
  matrixRoomId: string;
  displayLabel: string;
  kind: InnerNonProjectRoomKind;
}

export interface IProjectCommunicationArtifactsPort {
  listCommunicationRoomsForProject(projectHash: string): Promise<InnerProjectCommunicationRoomRef[]>;

  /** Комнаты вне проектов Capital (пайщики/совет/секретарь) — синхронизируются в blago отдельной верхней папкой. */
  listNonProjectCommunicationRooms(): Promise<InnerNonProjectCommunicationRoomRef[]>;

  listUtcDatesWithNewMessages(
    matrixRoomId: string,
    afterOriginServerTsExclusive: number
  ): Promise<string[]>;

  getMessagesForRoomAndUtcDate(matrixRoomId: string, utcDate: string): Promise<InnerRoomMessageLine[]>;

  getMaxOriginServerTsForRoom(matrixRoomId: string): Promise<number | null>;

  listCompletedTranscriptionsEndedAfter(
    matrixRoomIds: string[],
    endedAfterExclusive: Date
  ): Promise<InnerCompletedCallTranscriptionHead[]>;

  getMaxCompletedEndedAtForRooms(matrixRoomIds: string[]): Promise<Date | null>;

  renderCompletedCallTranscriptionMarkdown(transcriptionId: string): Promise<string | null>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────

/**
 * Артефакты переписки и транскрипций комнат. Провайдер — chatcoop.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const PROJECT_COMMUNICATION_ARTIFACTS_PORT = Symbol.for('Innercoop.CrossPlugin.ProjectCommunicationArtifacts');
