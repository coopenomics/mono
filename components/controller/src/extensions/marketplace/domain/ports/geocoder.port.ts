/**
 * Доменный порт геокодера (Эпик 2 Стола заказов, Story 2.2).
 *
 * Реализация — `YandexGeocoderAdapter` (адаптер к Yandex Geocoder API).
 * В тестах подменяется in-memory моком.
 */
export interface GeocoderPort {
  /**
   * Геокодирует адрес. Возвращает координаты при успехе, либо строку с ошибкой
   * при пустом ответе/сетевой ошибке. Адаптер обязан учитывать rate-limit
   * провайдера и не пробрасывать сетевые исключения наверх — только статус.
   */
  geocode(addressFull: string): Promise<GeocoderResult>;
}

export type GeocoderResult =
  | { status: 'OK'; lat: number; lng: number }
  | { status: 'FAILED'; errorMessage: string };

export const GEOCODER_PORT = Symbol('GeocoderPort');
