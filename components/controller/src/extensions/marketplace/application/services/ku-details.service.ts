import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { config } from '~/config';
import {
  KuDetailsDomainEntity,
  type WorkingHoursDomain,
} from '../../domain/entities/ku-details-domain.entity';
import {
  KU_DETAILS_DOMAIN_REPOSITORY,
  type KuDetailsDomainRepository,
} from '../../domain/repositories/ku-details-domain.repository';
import { GEOCODER_PORT, type GeocoderPort } from '../../domain/ports/geocoder.port';
import { DetailKUInputDTO } from '../dto/detail-ku-input.dto';
import { KuDetailsDTO } from '../dto/ku-details.dto';
import type { ListMarketplaceKUInputDTO } from '../dto/list-marketplace-ku-input.dto';
import type { SetKUStatusInputDTO } from '../dto/deactivate-ku-input.dto';

/**
 * Application-сервис marketplace-детализации существующих в core КУ
 * (Эпик 2, Story 2.1 + Story 2.2).
 *
 * — Story 2.1: upsert/edit/deactivate/list записей `marketplace_ku_details`.
 * — Story 2.2: post-create/update hook геокодинга через Yandex Geocoder.
 *   Изменение `addressFull` сбрасывает координаты на `PENDING` и запускает
 *   геокодинг заново; неуспех не прерывает основную транзакцию — статус
 *   сохраняется как `FAILED`, UI показывает индикатор и предлагает повтор.
 */
@Injectable()
export class KuDetailsService {
  private readonly logger = new Logger(KuDetailsService.name);

  constructor(
    @Inject(KU_DETAILS_DOMAIN_REPOSITORY)
    private readonly repo: KuDetailsDomainRepository,
    @Inject(GEOCODER_PORT)
    private readonly geocoder: GeocoderPort
  ) {}

  async detailKU(input: DetailKUInputDTO): Promise<KuDetailsDTO> {
    this.assertCurrentCoop(input.coopname);

    const existing = await this.repo.findByCoreBraname(input.coopname, input.coreBraname);
    const addressChanged = existing?.addressFull !== input.addressFull;

    const next = new KuDetailsDomainEntity({
      id: existing?.id,
      coopname: input.coopname,
      coreBraname: input.coreBraname,
      addressFull: input.addressFull,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      workingHours: input.workingHours as WorkingHoursDomain,
      description: input.description,
      status: existing?.status ?? 'ACTIVE',
      lat: addressChanged ? undefined : existing?.lat,
      lng: addressChanged ? undefined : existing?.lng,
      geocodeStatus: addressChanged ? 'PENDING' : (existing?.geocodeStatus ?? 'PENDING'),
      geocodeErrorMessage: addressChanged ? undefined : existing?.geocodeErrorMessage,
      geocodedAt: addressChanged ? undefined : existing?.geocodedAt,
      createdAt: existing?.createdAt,
      updatedAt: new Date(),
    });

    const saved = await this.repo.save(next);

    if (addressChanged || existing?.geocodeStatus !== 'OK') {
      void this.runGeocodeAndPersist(saved.coopname, saved.coreBraname, saved.addressFull);
    }

    return KuDetailsDTO.fromDomain(saved);
  }

  async setStatus(input: SetKUStatusInputDTO): Promise<KuDetailsDTO> {
    this.assertCurrentCoop(input.coopname);
    const updated = await this.repo.setStatus(input.coopname, input.coreBraname, input.status);
    if (!updated) {
      throw new NotFoundException(
        `marketplace_ku_details не найдена для (${input.coopname}, ${input.coreBraname})`
      );
    }
    return KuDetailsDTO.fromDomain(updated);
  }

  async list(input: ListMarketplaceKUInputDTO): Promise<KuDetailsDTO[]> {
    this.assertCurrentCoop(input.coopname);
    const rows = await this.repo.findByCoopname(input.coopname, { onlyActive: input.onlyActive ?? false });
    return rows.map((row) => KuDetailsDTO.fromDomain(row));
  }

  async retryGeocode(coopname: string, coreBraname: string): Promise<KuDetailsDTO> {
    this.assertCurrentCoop(coopname);
    const existing = await this.repo.findByCoreBraname(coopname, coreBraname);
    if (!existing) {
      throw new NotFoundException(`marketplace_ku_details не найдена для (${coopname}, ${coreBraname})`);
    }
    await this.runGeocodeAndPersist(coopname, coreBraname, existing.addressFull);
    const reread = await this.repo.findByCoreBraname(coopname, coreBraname);
    return KuDetailsDTO.fromDomain(reread!);
  }

  private async runGeocodeAndPersist(coopname: string, coreBraname: string, addressFull: string): Promise<void> {
    try {
      const result = await this.geocoder.geocode(addressFull);
      if (result.status === 'OK') {
        await this.repo.updateGeocode(coopname, coreBraname, {
          status: 'OK',
          lat: result.lat,
          lng: result.lng,
          geocodedAt: new Date(),
        });
      } else {
        await this.repo.updateGeocode(coopname, coreBraname, {
          status: 'FAILED',
          errorMessage: result.errorMessage,
          geocodedAt: new Date(),
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Геокодинг (${coopname}, ${coreBraname}) упал неожиданно: ${message}`);
      await this.repo.updateGeocode(coopname, coreBraname, {
        status: 'FAILED',
        errorMessage: message,
        geocodedAt: new Date(),
      });
    }
  }

  private assertCurrentCoop(coopname: string): void {
    if (coopname !== config.coopname) {
      throw new NotFoundException(
        `Controller обслуживает кооператив "${config.coopname}", запрос для "${coopname}" отклонён`
      );
    }
  }
}
