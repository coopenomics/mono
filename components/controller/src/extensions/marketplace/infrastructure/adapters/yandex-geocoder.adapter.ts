import { Injectable, Logger } from '@nestjs/common';
import type { GeocoderPort, GeocoderResult } from '../../domain/ports/geocoder.port';

const YANDEX_DEFAULT_BASE_URL = 'https://geocode-maps.yandex.ru/1.x/';

// Адаптер Yandex Geocoder HTTP API — конкретная реализация GeocoderPort.
// Сетевые исключения не пробрасываются — возвращаем FAILED со строкой ошибки.
// Локальный rate-limit (GEOCODER_RATE_LIMIT_RPS) реализован как sliding-window
// очередь — следующий запрос ждёт ближайший свободный slot.
/** Настройки геокодера, которые задаются в контуре. */
export interface YandexGeocoderSettings {
  api_key?: string;
  base_url?: string;
  timeout_ms?: number;
  /** Предел обращений в секунду; без него ограничение не применяется. */
  rate_limit_rps?: number;
}

@Injectable()
export class YandexGeocoderAdapter implements GeocoderPort {
  /** Настройки приходят из контура: у адаптера своих ключей нет. */
  constructor(private readonly settings: YandexGeocoderSettings) {}

  private readonly logger = new Logger(YandexGeocoderAdapter.name);
  private readonly slotTimestamps: number[] = [];

  async geocode(addressFull: string): Promise<GeocoderResult> {
    const apiKey = this.settings.api_key;
    if (!apiKey) {
      this.logger.warn('GEOCODER_API_KEY не задан — Yandex-геокодинг пропущен');
      return { status: 'FAILED', errorMessage: 'GEOCODER_API_KEY не задан в окружении' };
    }

    await this.acquireSlot();

    const url = new URL(this.settings.base_url || YANDEX_DEFAULT_BASE_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('geocode', addressFull);
    url.searchParams.set('format', 'json');
    url.searchParams.set('results', '1');

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.settings.timeout_ms);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        return { status: 'FAILED', errorMessage: `HTTP ${response.status} ${response.statusText}` };
      }
      const body = (await response.json()) as YandexGeocoderResponse;
      const member = body.response?.GeoObjectCollection?.featureMember;
      if (!member || member.length === 0) {
        return { status: 'FAILED', errorMessage: 'Geocoder вернул пустой результат' };
      }
      const pos = member[0]?.GeoObject?.Point?.pos;
      if (!pos) {
        return { status: 'FAILED', errorMessage: 'Geocoder вернул featureMember без pos' };
      }
      const [lngStr, latStr] = pos.split(' ');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return { status: 'FAILED', errorMessage: `Geocoder вернул нечисловой pos="${pos}"` };
      }
      return { status: 'OK', lat, lng };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'FAILED', errorMessage: message };
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  private async acquireSlot(): Promise<void> {
    const rps = this.settings.rate_limit_rps ?? 0;
    if (rps <= 0) return;

    const now = Date.now();
    while (this.slotTimestamps.length > 0 && now - this.slotTimestamps[0]! >= 1000) {
      this.slotTimestamps.shift();
    }

    if (this.slotTimestamps.length >= rps) {
      const oldest = this.slotTimestamps[0]!;
      const waitMs = 1000 - (now - oldest);
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.slotTimestamps.shift();
    }
    this.slotTimestamps.push(Date.now());
  }
}

interface YandexGeocoderResponse {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          Point?: { pos?: string };
        };
      }>;
    };
  };
}
