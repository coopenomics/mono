/**
 * Порт хранилища «известных устройств» пайщика (CoopID, Story 3.8). Множество
 * fingerprint'ов устройств, с которых пайщик успешно входил, — основа для
 * детекции нового устройства (Story 3.9). Реализация — Redis-адаптер контура.
 */
export const KNOWN_DEVICES_STORE = Symbol('KNOWN_DEVICES_STORE');

/** Метаданные одной встречи устройства (для списка/диагностики, не для auth-решений). */
export interface KnownDeviceMeta {
  ip: string | null;
  userAgent: string | null;
  /** ISO-время первой встречи устройства (сохраняется между входами). */
  firstSeen: string;
  /** ISO-время последнего входа с устройства (обновляется). */
  lastSeen: string;
}

export interface IKnownDevicesStore {
  /** Видели ли устройство `fingerprint` у пайщика раньше. */
  isKnown(subjectId: string, fingerprint: string): Promise<boolean>;
  /**
   * Запомнить устройство (или обновить lastSeen существующего). `firstSeen`
   * существующего устройства сохраняется. `ip`/`userAgent` — последняя встреча.
   */
  remember(subjectId: string, fingerprint: string, meta: { ip: string | null; userAgent: string | null }): Promise<void>;
}
