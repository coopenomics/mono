import { Logger } from '@nestjs/common';
import { config } from '~/config';
import type { GeocoderPort } from '../../domain/ports/geocoder.port';
import { NoopGeocoderAdapter } from './noop-geocoder.adapter';
import { YandexGeocoderAdapter } from './yandex-geocoder.adapter';

// Фабрика реализаций GeocoderPort: выбирает адаптер по config.geocoder.provider.
// Добавление нового провайдера — отдельный адаптер + ветка switch здесь;
// доменный код и application service от выбора не зависят.
export function geocoderPortFactory(): GeocoderPort {
  const logger = new Logger('GeocoderFactory');
  const provider = config.geocoder.provider;

  switch (provider) {
    case 'yandex':
      logger.log('Геокодер: Yandex');
      return new YandexGeocoderAdapter();
    case 'noop':
    default:
      logger.log(`Геокодер: noop${provider === 'noop' ? '' : ` (неизвестный provider="${String(provider)}")`}`);
      return new NoopGeocoderAdapter();
  }
}
