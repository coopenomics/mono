/**
 * Сообщения Matrix в истории (текст и расшифрованное аудио).
 * Календарные сутки UTC: YYYY-MM-DD.
 */
export type InterRoomMessageKind = 'text' | 'audio';

export interface InterRoomMessageLine {
  originServerTs: number;
  authorLabel: string;
  coopUsername: string | null;
  kind: InterRoomMessageKind;
  bodyText: string;
}

export interface InterCompletedCallTranscriptionHead {
  id: string;
  matrixRoomId: string;
  roomName: string;
  startedAt: Date;
  endedAt: Date | null;
}

/** Комната проекта Capital в реестре ChatCoop (kind capital_project). */
export interface InterProjectCommunicationRoomRef {
  matrixRoomId: string;
  displayLabel: string;
}

/** Тип непроектной комнаты ChatCoop, синхронизируемой в blago отдельной верхней папкой. */
export type InterNonProjectRoomKind = 'members' | 'council' | 'secretary';

/** Комната ChatCoop вне проекта Capital (пайщики/совет/секретарь) — для синхронизации переписки и транскрипций в blago. */
export interface InterNonProjectCommunicationRoomRef {
  matrixRoomId: string;
  displayLabel: string;
  kind: InterNonProjectRoomKind;
}

export interface InterProjectCommunicationArtifactsPort {
  listCommunicationRoomsForProject(projectHash: string): Promise<InterProjectCommunicationRoomRef[]>;

  /** Комнаты вне проектов Capital (пайщики/совет/секретарь) — синхронизируются в blago отдельной верхней папкой. */
  listNonProjectCommunicationRooms(): Promise<InterNonProjectCommunicationRoomRef[]>;

  listUtcDatesWithNewMessages(
    matrixRoomId: string,
    afterOriginServerTsExclusive: number
  ): Promise<string[]>;

  getMessagesForRoomAndUtcDate(matrixRoomId: string, utcDate: string): Promise<InterRoomMessageLine[]>;

  getMaxOriginServerTsForRoom(matrixRoomId: string): Promise<number | null>;

  listCompletedTranscriptionsEndedAfter(
    matrixRoomIds: string[],
    endedAfterExclusive: Date
  ): Promise<InterCompletedCallTranscriptionHead[]>;

  getMaxCompletedEndedAtForRooms(matrixRoomIds: string[]): Promise<Date | null>;

  renderCompletedCallTranscriptionMarkdown(transcriptionId: string): Promise<string | null>;
}
