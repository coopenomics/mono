/**
 * Тип комнаты Matrix, зарегистрированной в реестре ChatCoop (централизованное хранение).
 */
export type ChatcoopManagedMatrixRoomKind = 'members' | 'council' | 'capital_project' | 'secretary';

/**
 * Запись о Matrix-комнате кооператива: источник правды для LiveKit/секретаря; совет при миграции v3 из legacy-конфига.
 */
export interface ManagedMatrixRoomDomainEntity {
  id: string;
  matrixRoomId: string;
  /** true — комната с E2EE; секретарь в такие комнаты не подключается и не транскрибирует */
  encrypted: boolean;
  kind: ChatcoopManagedMatrixRoomKind;
  displayLabel: string;
  /** Для kind === capital_project */
  projectHash: string | null;
  /** Секретарь добавлен в комнату Matrix (актуализируется через Matrix API при старте контроллера) */
  secretaryInRoom: boolean;
  /** Курсор /messages для инжеста истории (PG) */
  messageHistoryPaginationToken: string | null;
  /** Backfill истории до конца — дальше не крутим старые страницы */
  messageHistoryBackfillComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}
