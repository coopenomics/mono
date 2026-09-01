/** Человекочитаемые заглушки, когда метаданные устройства/IP сессии не сохранялись. */
export const SESSION_DEVICE_UNKNOWN = 'неизвестное устройство';
export const SESSION_IP_UNKNOWN = 'неизвестен';

/**
 * Активная сессия пайщика (Story 3.7) — проекция персистентного refresh-токена,
 * обогащённая метаданными устройства/IP из side-store (записаны при входе, 3.8/3.7).
 */
export interface ActiveSession {
  /** Идентификатор сессии = id строки refresh-токена в платформенном токен-сторе. */
  id: string;
  /** User-Agent устройства входа; SESSION_DEVICE_UNKNOWN, если метаданные отсутствуют. */
  device: string;
  /** IP входа; SESSION_IP_UNKNOWN, если метаданные отсутствуют. */
  ip: string;
  /** Время создания сессии (ISO-строка). */
  createdAt: string;
  /** Последняя зафиксированная активность (ISO); при отсутствии = createdAt. */
  lastSeenAt: string;
  /** Текущая сессия (с которой выполнен запрос), если её удалось опознать по refresh-токену. */
  current: boolean;
}
