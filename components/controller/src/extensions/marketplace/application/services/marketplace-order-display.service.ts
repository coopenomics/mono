import { Inject, Injectable } from '@nestjs/common';

import config from '~/config/config';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '~/domain/common/repositories/organization.repository';

import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  KU_DETAILS_DOMAIN_REPOSITORY,
  type KuDetailsDomainRepository,
} from '../../domain/repositories/ku-details-domain.repository';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDisplayFields } from '../dto/marketplace-order.dto';

export const MARKETPLACE_ORDER_DISPLAY_SERVICE = Symbol('MARKETPLACE_ORDER_DISPLAY_SERVICE');

/**
 * Заказ ссылается на предложение и ПВЗ по идентификаторам и не несёт
 * отображаемых реквизитов. Этот сервис — единственная точка, где они
 * собираются для UI обеих столов (заказчик/поставщик) и лент выдачи:
 *
 *   - название товара и единица измерения — из предложения (батч по offer_id);
 *   - адрес ПВЗ — из marketplace-детализации КУ (адрес физического пункта,
 *     может отличаться от юридического адреса организации участка);
 *   - наименование ПВЗ — живьём из наименования организации кооперативного
 *     участка (`short_name`) по его аккаунту-`braname`. Намеренно НЕ копируем
 *     имя в детализацию ПВЗ при её создании: копия отстаёт при переименовании
 *     участка, а live-резолв всегда отдаёт актуальное имя. Организация/КУ — это
 *     core-домен (общий с платформой), поэтому читаем напрямую через core
 *     `ORGANIZATION_REPOSITORY`, а не через ext↔ext мост `inter`.
 *
 * Best-effort: отсутствующее предложение/ПВЗ/организация оставляют
 * соответствующие поля пустыми — лента заказов никогда не падает из-за
 * косметического реквизита.
 */
@Injectable()
export class MarketplaceOrderDisplayService {
  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(KU_DETAILS_DOMAIN_REPOSITORY)
    private readonly kuRepo: KuDetailsDomainRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepo: OrganizationRepository
  ) {}

  /**
   * Обогащение страницы заказов отображаемыми реквизитами одним проходом:
   * предложения тянутся батчем по уникальным offer_id, детализация ПВЗ — одной
   * выборкой по кооперативу, наименования КУ — параллельно по уникальным
   * branames. Возвращает карту order.id → реквизиты.
   */
  async enrich(
    orders: MarketplaceOrderDomainEntity[]
  ): Promise<Map<string, MarketplaceOrderDisplayFields>> {
    const result = new Map<string, MarketplaceOrderDisplayFields>();
    if (orders.length === 0) return result;

    const offerIds = [...new Set(orders.map((o) => o.offer_id))];
    const branames = [...new Set(orders.map((o) => o.delivery_braname))];
    const [offers, kuList, nameByBraname] = await Promise.all([
      this.offerRepo.findByIds(offerIds),
      this.kuRepo.findByCoopname(config.coopname),
      this.resolveKuNames(branames),
    ]);
    const offerById = new Map(offers.map((offer) => [offer.id, offer]));
    const addressByBraname = new Map(kuList.map((ku) => [ku.coreBraname, ku.addressFull]));

    for (const order of orders) {
      const offer = offerById.get(order.offer_id);
      result.set(order.id, {
        product_name: offer?.product_name ?? null,
        unit_of_measure: offer?.unit_of_measure ?? null,
        delivery_point_name: nameByBraname.get(order.delivery_braname) ?? null,
        delivery_point_address: addressByBraname.get(order.delivery_braname) ?? null,
      });
    }
    return result;
  }

  /** Реквизиты одного заказа (для getOrder). Делегирует в батч-проход. */
  async enrichOne(order: MarketplaceOrderDomainEntity): Promise<MarketplaceOrderDisplayFields> {
    const map = await this.enrich([order]);
    return map.get(order.id) ?? {};
  }

  private async resolveKuNames(branames: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    await Promise.all(
      branames.map(async (braname) => {
        const name = await this.safeOrgShortName(braname);
        if (name) map.set(braname, name);
      })
    );
    return map;
  }

  /**
   * Наименование организации участка по аккаунту-`braname`. `findByUsername`
   * бросает, если организация не найдена, — для best-effort отображения это
   * штатная ситуация (имя необязательно), поэтому глушим в null и не роняем
   * ленту. Это read-path обогащение, а не sync-пайплайн, где глушить нельзя.
   */
  private async safeOrgShortName(braname: string): Promise<string | null> {
    try {
      const org = await this.orgRepo.findByUsername(braname);
      return org?.short_name?.trim() || null;
    } catch {
      return null;
    }
  }
}
