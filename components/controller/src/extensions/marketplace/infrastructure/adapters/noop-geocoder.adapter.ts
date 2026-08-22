import { Injectable, Logger } from '@nestjs/common';
import type { GeocoderPort, GeocoderResult } from '../../domain/ports/geocoder.port';

// No-op геокодер: выбирается, когда GEOCODER_PROVIDER=noop или провайдер
// явно не сконфигурирован. Всегда отвечает FAILED, ПВЗ остаётся в статусе
// PENDING до настройки реального провайдера.
@Injectable()
export class NoopGeocoderAdapter implements GeocoderPort {
  private readonly logger = new Logger(NoopGeocoderAdapter.name);

  async geocode(_addressFull: string): Promise<GeocoderResult> {
    this.logger.debug('GEOCODER_PROVIDER=noop — геокодинг пропущен');
    return { status: 'FAILED', errorMessage: 'Геокодинг отключён (GEOCODER_PROVIDER=noop)' };
  }
}
