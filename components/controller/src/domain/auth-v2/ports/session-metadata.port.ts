export const SESSION_METADATA_PORT = Symbol('SessionMetadataPort');

/** Снимок метаданных сессии, хранимый в side-store (Redis). */
export interface SessionMetadata {
  /** IP входа; null, если был неизвестен на момент записи. */
  ip: string | null;
  /** User-Agent устройства входа; null, если не передан. */
  device: string | null;
  /** Время создания сессии (ISO). */
  createdAt: string;
  /** Последняя активность (ISO); инициализируется createdAt. */
  lastSeenAt: string;
}

/**
 * Порт метаданных сессий CoopID (Story 3.7). Сама сессия — это refresh-токен в
 * платформенном токен-сторе; здесь хранится только описательная обвязка (устройство/IP/
 * время), которой нет в токен-сущности. Адресация — по самому refresh-токену (реализация
 * хэширует его и токен в открытом виде не хранит). Отсутствие записи не должно скрывать
 * сессию — потребитель показывает её с заглушками.
 */
export interface ISessionMetadataStore {
  /** Сохранить метаданные сессии (TTL = срок жизни refresh-токена). */
  record(refreshToken: string, meta: { ip: string | null; device: string | null; createdAt: string }): Promise<void>;
  /** Прочитать метаданные по refresh-токену; null, если не сохранялись/истекли. */
  get(refreshToken: string): Promise<SessionMetadata | null>;
  /** Удалить метаданные при отзыве сессии. */
  delete(refreshToken: string): Promise<void>;
}
