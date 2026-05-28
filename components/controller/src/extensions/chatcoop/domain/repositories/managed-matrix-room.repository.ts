import type {
  ChatcoopManagedMatrixRoomKind,
  ManagedMatrixRoomDomainEntity,
} from '../entities/managed-matrix-room.entity';

/** Вход для upsert без служебных полей БД */
export interface UpsertManagedMatrixRoomInput {
  matrixRoomId: string;
  encrypted: boolean;
  kind: ChatcoopManagedMatrixRoomKind;
  displayLabel: string;
  projectHash: string | null;
  /** Если не передано — при upsert сохраняется прежнее значение из БД, для новой строки false */
  secretaryInRoom?: boolean;
}

/**
 * Реестр Matrix-комнат ChatCoop: пайщики, совет, проекты Capital.
 * Секретарь обрабатывает только комнаты с encrypted === false.
 */
export interface ChatcoopManagedMatrixRoomRepository {
  upsertRoom(input: UpsertManagedMatrixRoomInput): Promise<ManagedMatrixRoomDomainEntity>;
  /** Поиск по внутреннему идентификатору реестра (не Matrix room id) — для операций из интерфейса. */
  findById(id: string): Promise<ManagedMatrixRoomDomainEntity | null>;
  findByMatrixRoomId(matrixRoomId: string): Promise<ManagedMatrixRoomDomainEntity | null>;
  findByKind(kind: ChatcoopManagedMatrixRoomKind): Promise<ManagedMatrixRoomDomainEntity[]>;
  /** Комнаты проекта Capital (kind capital_project, projectHash задан). */
  findByProjectHash(projectHash: string): Promise<ManagedMatrixRoomDomainEntity[]>;
  /** Все комнаты реестра (для интерфейса управления присутствием секретаря). */
  findAll(): Promise<ManagedMatrixRoomDomainEntity[]>;
  /** Комнаты, не привязанные к проекту Capital (members/council/secretary) — для синхронизации в blago. */
  findNonProjectCommunicationRooms(): Promise<ManagedMatrixRoomDomainEntity[]>;
  /** Комнаты, в которых секретарь может участвовать в звонке и писать plaintext в Matrix */
  findEligibleForSecretaryTranscription(): Promise<ManagedMatrixRoomDomainEntity[]>;
  /** Обновить флаг членства секретаря (после успешного join или проверки Matrix) */
  setSecretaryInRoom(matrixRoomId: string, secretaryInRoom: boolean): Promise<void>;
  /** Удалить запись реестра (например, при замене комнаты пайщиков при миграции) */
  deleteByMatrixRoomId(matrixRoomId: string): Promise<void>;

  /** Состояние инжеста истории Matrix (курсор /messages + завершён ли backfill) */
  updateMessageHistoryIngestState(
    matrixRoomId: string,
    patch: { paginationToken: string | null; backfillComplete: boolean }
  ): Promise<void>;
}

export const CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY = Symbol('ChatcoopManagedMatrixRoomRepository');
