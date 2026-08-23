import { Logger } from '@nestjs/common';
import type { GeocoderPort } from '../../domain/ports/geocoder.port';
import { NoopGeocoderAdapter } from './noop-geocoder.adapter';
import { YandexGeocoderAdapter, type YandexGeocoderSettings } from './yandex-geocoder.adapter';

// Фабрика реализаций GeocoderPort: выбирает адаптер по настройке контура.
// Добавление нового провайдера — отдельный адаптер + ветка switch здесь;
// доменный код и application service от выбора не зависят.
export function geocoderPortFactory(
  settings: (YandexGeocoderSettings & { provider?: string }) | null
): GeocoderPort {
  const logger = new Logger('GeocoderFactory');
  const provider = settings?.provider;

  switch (provider) {
    case 'yandex':
      logger.log('Геокодер: Yandex');
      return new YandexGeocoderAdapter(settings ?? {});
    case 'noop':
    default:
      logger.log(`Геокодер: noop${provider === 'noop' ? '' : ` (неизвестный provider="${String(provider)}")`}`);
      return new NoopGeocoderAdapter();
  }
}
