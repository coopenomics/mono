/**
 * Порт настроек кооператива (coop_domain_db, таблица `coop_settings`, Story 4.6).
 * Singleton-запись глобальных параметров кооператива. Пока единственная настройка —
 * срок жизни participant_certificate.
 */
export interface ICoopSettingsRepository {
  /** TTL сертификата (сек) из БД; null — записи нет или значение нечисловое. */
  getCertTtlSeconds(): Promise<number | null>;
  /** Сохранить TTL сертификата (сек). Зажатие в допустимые пределы — на стороне сервиса. */
  setCertTtlSeconds(seconds: number): Promise<void>;
}

export const COOP_SETTINGS_REPOSITORY = Symbol('CoopSettingsRepository');

/** Дефолтный срок жизни сертификата (сек): 1 час (Story 4.6 AC). */
export const CERT_TTL_DEFAULT_SECONDS = 3600;
/** Минимальный допустимый TTL (сек) в MVP: 60с — ниже сертификат бесполезен. */
export const CERT_TTL_MIN_SECONDS = 60;
/** Максимальный допустимый TTL (сек) в MVP: 24ч — выше теряется смысл «короткого» окна. */
export const CERT_TTL_MAX_SECONDS = 24 * 60 * 60;
