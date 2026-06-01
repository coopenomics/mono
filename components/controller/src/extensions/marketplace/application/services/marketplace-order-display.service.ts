import { Inject, Injectable } from '@nestjs/common';

import config from '~/config/config';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '~/domain/common/repositories/organization.repository';
import { UserCertificateInteractor } from '~/application/user/interactors/user-certificate.interactor';
import { AccountType } from '~/application/account/enum/account-type.enum';

import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  KU_DETAILS_DOMAIN_REPOSITORY,
  type KuDetailsDomainRepository,
} from '../../domain/repositories/ku-details-domain.repository';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
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
    private readonly orgRepo: OrganizationRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    private readonly userCertificate: UserCertificateInteractor
  ) {}

  /**
   * Обогащение страницы заказов отображаемыми реквизитами одним проходом:
   * предложения тянутся батчем по уникальным offer_id, детализация ПВЗ — одной
   * выборкой по кооперативу, наименования КУ — параллельно по уникальным
   * branames. Возвращает карту order.id → реквизиты.
   */
  async enrich(
    orders: MarketplaceOrderDomainEntity[],
    opts?: { withParticipantNames?: boolean }
  ): Promise<Map<string, MarketplaceOrderDisplayFields>> {
    const result = new Map<string, MarketplaceOrderDisplayFields>();
    if (orders.length === 0) return result;

    const offerIds = [...new Set(orders.map((o) => o.offer_id))];
    const branames = [...new Set(orders.map((o) => o.delivery_braname))];
    // Имена участников (ФИО/наименование) резолвим только для экранов приёмки/
    // выдачи — оператор/председатель КУ должен видеть «от кого/кому». Авторизация
    // — на стороне вызывающего резолвера (он уже ограничен ролью/членством КУ).
    const accounts = opts?.withParticipantNames
      ? orders.flatMap((o) => [o.orderer_account, o.supplier_account])
      : [];
    const [offers, kuList, nameByBraname, nameByAccount] = await Promise.all([
      this.offerRepo.findByIds(offerIds),
      this.kuRepo.findByCoopname(config.coopname),
      this.resolveKuNames(branames),
      this.resolveAccountNames(accounts),
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
        orderer_name: nameByAccount.get(order.orderer_account) ?? null,
        supplier_name: nameByAccount.get(order.supplier_account) ?? null,
      });
    }
    return result;
  }

  /** Реквизиты одного заказа (для getOrder). Делегирует в батч-проход. */
  async enrichOne(order: MarketplaceOrderDomainEntity): Promise<MarketplaceOrderDisplayFields> {
    const map = await this.enrich([order]);
    return map.get(order.id) ?? {};
  }

  /**
   * Реквизиты заказов по их идентификаторам (для позиций приёмки, где известны
   * только order_id из снапшота факта). Грузит заказы батчем и делегирует в
   * `enrich`. Имена участников здесь не нужны — только товар/единица/ПВЗ.
   */
  async enrichByOrderIds(orderIds: string[]): Promise<Map<string, MarketplaceOrderDisplayFields>> {
    const ids = [...new Set(orderIds.filter((id) => id))];
    if (ids.length === 0) return new Map();
    const orders = await this.orderRepo.findByIds(ids);
    return this.enrich(orders);
  }

  /**
   * Публичный одиночный резолв отображаемого имени аккаунта (ФИО/`short_name`).
   * Используется field-резолверами DTO (оферта → `supplier_name` и т.п.), чтобы
   * имя бралось живьём на бэкенде, а фронт не дозапрашивал его отдельно.
   */
  async resolveAccountName(account: string): Promise<string | null> {
    if (!account) return null;
    return this.safeDisplayName(account);
  }

  /**
   * Отображаемые реквизиты участка (ПВЗ) по его аккаунту-`braname`, живьём из
   * единого источника правды: наименование и адрес — из организации участка
   * (core-домен, тот же, что правит председатель в «Кооперативные участки»),
   * координаты — из геокода marketplace-детализации КУ. Локальную копию адреса
   * в детализации НЕ используем как источник — только как носитель геоточки.
   */
  async resolveBranchDisplay(
    braname: string
  ): Promise<{ name: string | null; address: string | null; lat: number | null; lng: number | null }> {
    if (!braname) return { name: null, address: null, lat: null, lng: null };
    const [org, ku] = await Promise.all([this.safeOrg(braname), this.safeKu(braname)]);
    const name = org?.short_name?.trim() || org?.full_name?.trim() || null;
    const address = org?.fact_address?.trim() || org?.full_address?.trim() || null;
    const hasCoords = ku?.geocodeStatus === 'OK' && ku.lat != null && ku.lng != null;
    return {
      name,
      address,
      lat: hasCoords ? (ku!.lat as number) : null,
      lng: hasCoords ? (ku!.lng as number) : null,
    };
  }

  private async safeOrg(braname: string) {
    try {
      return await this.orgRepo.findByUsername(braname);
    } catch {
      return null;
    }
  }

  private async safeKu(braname: string) {
    try {
      return await this.kuRepo.findByCoreBraname(config.coopname, braname);
    } catch {
      return null;
    }
  }

  /**
   * Отображаемые наименования участников по аккаунтам: ФИО физлица/ИП или
   * `short_name` организации. Батч с дедупликацией; best-effort — недоступное
   * имя пропускается (клиент покажет аккаунт). Источник имён — приватные данные
   * аккаунта, поэтому вызывать только из уже авторизованных резолверов.
   */
  async resolveAccountNames(accounts: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const unique = [...new Set(accounts.filter((a) => a))];
    if (unique.length === 0) return result;
    await Promise.all(
      unique.map(async (account) => {
        const name = await this.safeDisplayName(account);
        if (name) result.set(account, name);
      })
    );
    return result;
  }

  /**
   * Наименование участника по аккаунту. Организация → `short_name`; физлицо/ИП →
   * «Фамилия Имя Отчество». Бросок/отсутствие сертификата → null (best-effort).
   */
  private async safeDisplayName(account: string): Promise<string | null> {
    try {
      const cert = await this.userCertificate.getCertificateByUsername(account);
      if (!cert) return null;
      if (cert.type === AccountType.organization) {
        return cert.short_name?.trim() || null;
      }
      return (
        [cert.last_name, cert.first_name, cert.middle_name]
          .filter((part) => part && part.trim())
          .join(' ')
          .trim() || null
      );
    } catch {
      return null;
    }
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
