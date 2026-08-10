import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  GeocodeStatuses,
  KuDetailsDomainEntity,
  KuDetailsStatuses,
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
import { ORGANIZATION_PORT, type IOrganizationPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';

/**
 * Application-сервис marketplace-детализации существующих в core КУ
 * (Эпик 2, Story 2.1 + Story 2.2).
 *
 * — Story 2.1: upsert/edit/deactivate/list записей `marketplace_ku_details`.
 *   Реквизиты участка (наименование/адрес/контакты) здесь НЕ хранятся — единый
 *   источник правды это организация участка (правит председатель в
 *   «Кооперативные участки»). ПВЗ-детализация несёт только режим работы,
 *   описание, статус и кэш геокода.
 * — Story 2.2: hook геокодинга через Yandex Geocoder по адресу организации.
 *   Расхождение адреса организации с `geocodedAddress` (кэш-ключ) сбрасывает
 *   координаты на `PENDING` и запускает геокодинг заново; неуспех не прерывает
 *   основную транзакцию — статус сохраняется как `FAILED`, UI предлагает повтор.
 *   Reconcile ленивый: при чтении списка дрейф адреса перезапускает геокодинг.
 */
@Injectable()
export class KuDetailsService {
  private readonly logger = new Logger(KuDetailsService.name);

  constructor(
    @Inject(KU_DETAILS_DOMAIN_REPOSITORY)
    private readonly repo: KuDetailsDomainRepository,
    @Inject(GEOCODER_PORT)
    private readonly geocoder: GeocoderPort,
    @Inject(ORGANIZATION_PORT)
    private readonly orgRepo: IOrganizationPort
  ) {}

  async detailKU(input: DetailKUInputDTO): Promise<KuDetailsDTO> {
    this.assertCurrentCoop(input.coopname);

    const orgAddress = await this.resolveOrgAddress(input.coreBraname);
    const existing = await this.repo.findByCoreBraname(input.coopname, input.coreBraname);
    const addressChanged = existing?.geocodedAddress !== orgAddress;

    const next = new KuDetailsDomainEntity({
      id: existing?.id,
      coopname: input.coopname,
      coreBraname: input.coreBraname,
      // geocodedAddress сохраняем как есть — его обновит post-effect геокодинга
      geocodedAddress: existing?.geocodedAddress,
      workingHours: input.workingHours as WorkingHoursDomain,
      description: input.description,
      status: existing?.status ?? KuDetailsStatuses.ACTIVE,
      lat: addressChanged ? undefined : existing?.lat,
      lng: addressChanged ? undefined : existing?.lng,
      geocodeStatus: addressChanged
        ? GeocodeStatuses.PENDING
        : (existing?.geocodeStatus ?? GeocodeStatuses.PENDING),
      geocodeErrorMessage: addressChanged ? undefined : existing?.geocodeErrorMessage,
      geocodedAt: addressChanged ? undefined : existing?.geocodedAt,
      createdAt: existing?.createdAt,
      updatedAt: new Date(),
    });

    const saved = await this.repo.save(next);

    if (orgAddress && (addressChanged || existing?.geocodeStatus !== GeocodeStatuses.OK)) {
      void this.runGeocodeAndPersist(saved.coopname, saved.coreBraname, orgAddress);
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
    // Ленивый reconcile: если председатель сменил адрес участка в core, дрейф с
    // кэш-ключом `geocodedAddress` перезапускает геокодинг (fire-and-forget).
    for (const row of rows) void this.reconcileGeocode(row);
    return rows.map((row) => KuDetailsDTO.fromDomain(row));
  }

  async retryGeocode(coopname: string, coreBraname: string): Promise<KuDetailsDTO> {
    this.assertCurrentCoop(coopname);
    const existing = await this.repo.findByCoreBraname(coopname, coreBraname);
    if (!existing) {
      throw new NotFoundException(`marketplace_ku_details не найдена для (${coopname}, ${coreBraname})`);
    }
    const orgAddress = await this.resolveOrgAddress(coreBraname);
    if (!orgAddress) {
      throw new NotFoundException(`У организации участка "${coreBraname}" не задан адрес для геокодинга`);
    }
    await this.runGeocodeAndPersist(coopname, coreBraname, orgAddress);
    const reread = await this.repo.findByCoreBraname(coopname, coreBraname);
    return KuDetailsDTO.fromDomain(reread!);
  }

  /** Адрес участка из его организации (единый источник правды), best-effort. */
  private async resolveOrgAddress(braname: string): Promise<string | null> {
    try {
      const org = await this.orgRepo.findByUsername(braname);
      return org?.fact_address?.trim() || org?.full_address?.trim() || null;
    } catch {
      return null;
    }
  }

  /** Перегеокодирование при дрейфе адреса организации vs кэш-ключ `geocodedAddress`. */
  private async reconcileGeocode(row: KuDetailsDomainEntity): Promise<void> {
    const orgAddress = await this.resolveOrgAddress(row.coreBraname);
    if (!orgAddress) return;
    // Сверяем только с кэш-ключом: при том же адресе не дёргаем геокодер повторно
    // даже на FAILED — это спам; ручной повтор закрыт `retryGeocode`.
    if (row.geocodedAddress === orgAddress) return;
    await this.runGeocodeAndPersist(row.coopname, row.coreBraname, orgAddress);
  }

  private async runGeocodeAndPersist(coopname: string, coreBraname: string, addressFull: string): Promise<void> {
    try {
      const result = await this.geocoder.geocode(addressFull);
      if (result.status === 'OK') {
        await this.repo.updateGeocode(coopname, coreBraname, {
          status: GeocodeStatuses.OK,
          lat: result.lat,
          lng: result.lng,
          geocodedAt: new Date(),
          geocodedAddress: addressFull,
        });
      } else {
        await this.repo.updateGeocode(coopname, coreBraname, {
          status: GeocodeStatuses.FAILED,
          errorMessage: result.errorMessage,
          geocodedAt: new Date(),
          geocodedAddress: addressFull,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Геокодинг (${coopname}, ${coreBraname}) упал неожиданно: ${message}`);
      await this.repo.updateGeocode(coopname, coreBraname, {
        status: GeocodeStatuses.FAILED,
        errorMessage: message,
        geocodedAt: new Date(),
        geocodedAddress: addressFull,
      });
    }
  }

  private assertCurrentCoop(coopname: string): void {
    if (coopname !== platformSettings().coopname) {
      throw new NotFoundException(
        `Controller обслуживает кооператив "${platformSettings().coopname}", запрос для "${coopname}" отклонён`
      );
    }
  }
}
