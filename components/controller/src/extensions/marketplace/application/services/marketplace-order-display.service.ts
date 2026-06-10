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
import { GeocodeStatuses } from '../../domain/entities/ku-details-domain.entity';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { MarketplaceOrderStatuses } from '../../domain/entities/marketplace-order.types';
import type { MarketplaceOrderDisplayFields } from '../dto/marketplace-order.dto';

export const MARKETPLACE_ORDER_DISPLAY_SERVICE = Symbol('MARKETPLACE_ORDER_DISPLAY_SERVICE');

/**
 * Заказ ссылается на предложение и ПВЗ по идентификаторам и не несёт
 * отображаемых реквизитов. Этот сервис — единственная точка, где они
 * собираются для UI обеих столов (заказчик/поставщик) и лент выдачи:
 *
 *   - название товара и единица измерения — из предложения (батч по offer_id);
 *   - наименование и адрес ПВЗ — живьём из организации кооперативного участка
 *     (`short_name`/`fact_address`) по его аккаунту-`braname`. Намеренно НЕ
 *     копируем реквизиты в детализацию ПВЗ: копия отстаёт при правке участка
 *     председателем, а live-резолв всегда отдаёт актуальные данные. Организация/
 *     КУ — core-домен (общий с платформой), поэтому читаем напрямую через core
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
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
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
    opts?: {
      withParticipantNames?: boolean;
      withGroupProgress?: boolean;
      /**
       * Подмешать принятое на склад и не выданное количество по заказу
       * (`warehouse_quantity`) — для лент выдачи, где оператор и заказчик
       * должны видеть «сколько реально есть», а не только заказанное.
       */
      withWarehouseQuantity?: boolean;
    }
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
    // Идентификаторы сформированных партий — для коллективного объёма принятых
    // партий (тот же прогресс, что и у накопителя; единый вид карточки).
    const cycleIds = opts?.withGroupProgress
      ? ([...new Set(orders.map((o) => o.cycle_id).filter((c): c is string => !!c))])
      : [];
    const [offers, branchByBraname, nameByAccount, groupSums, cycleSums, warehouseByOrderId] =
      await Promise.all([
        this.offerRepo.findByIds(offerIds),
        this.resolveBranches(branames),
        this.resolveAccountNames(accounts),
        // «Сколько накоплено» по парам (offer × КУ) и по партиям считаем только
        // когда лента должна показать прогресс сбора (стол заказчика).
        opts?.withGroupProgress
          ? this.orderRepo.sumActiveByOfferBranch(config.coopname, offerIds)
          : Promise.resolve([]),
        cycleIds.length
          ? this.orderRepo.sumByCycleIds(config.coopname, cycleIds)
          : Promise.resolve([]),
        opts?.withWarehouseQuantity
          ? this.inventoryRepo.sumOnWarehouseByOrders(
              config.coopname,
              orders.map((o) => o.id)
            )
          : Promise.resolve(new Map<string, number>()),
      ]);
    const offerById = new Map(offers.map((offer) => [offer.id, offer]));
    // Ключ (offer_id::braname) → накоплено всеми на этапе сбора.
    const accumulatedByKey = new Map<string, number>();
    for (const g of groupSums) {
      accumulatedByKey.set(`${g.offer_id}::${g.delivery_braname}`, g.total);
    }
    // cycle_id → коллективный объём уже сформированной партии.
    const cycleTotalById = new Map<string, number>();
    for (const c of cycleSums) cycleTotalById.set(c.cycle_id, c.total);

    for (const order of orders) {
      const offer = offerById.get(order.offer_id);
      const branch = branchByBraname.get(order.delivery_braname);
      // Целевой минимум КУ — свойство пары (offer × КУ), известен на любой
      // стадии. Накоплено: на этапе сбора (ACTIVE) — сумма активного пула пары,
      // иначе — коллективный объём партии (cycle_id), в которую заказ вошёл.
      const minVolume = opts?.withGroupProgress
        ? (offer?.delivery_points?.find((d) => d.braname === order.delivery_braname)
            ?.min_supply_volume ?? null)
        : null;
      let accumulated: number | null = null;
      if (opts?.withGroupProgress) {
        if (order.status === MarketplaceOrderStatuses.ACTIVE) {
          accumulated =
            accumulatedByKey.get(`${order.offer_id}::${order.delivery_braname}`) ??
            order.quantity;
        } else if (order.cycle_id) {
          accumulated = cycleTotalById.get(order.cycle_id) ?? order.quantity;
        } else {
          accumulated = order.quantity;
        }
      }
      result.set(order.id, {
        product_name: offer?.product_name ?? null,
        unit_of_measure: offer?.unit_of_measure ?? null,
        delivery_point_name: branch?.name ?? null,
        delivery_point_address: branch?.address ?? null,
        delivery_point_lat: branch?.lat ?? null,
        delivery_point_lng: branch?.lng ?? null,
        orderer_name: nameByAccount.get(order.orderer_account) ?? null,
        supplier_name: nameByAccount.get(order.supplier_account) ?? null,
        group_accumulated_quantity: accumulated,
        group_min_volume: minVolume,
        // 0 (а не null) для заказа без позиций на складе: лента выдачи должна
        // явно показать «принято 0», null зарезервирован за «не запрашивали».
        warehouse_quantity: opts?.withWarehouseQuantity
          ? (warehouseByOrderId.get(order.id) ?? 0)
          : null,
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
    const { name, address } = this.orgDisplay(org);
    const hasCoords = ku?.geocodeStatus === GeocodeStatuses.OK && ku.lat != null && ku.lng != null;
    return {
      name,
      address,
      lat: hasCoords ? (ku!.lat as number) : null,
      lng: hasCoords ? (ku!.lng as number) : null,
    };
  }

  /**
   * Контакты участка (наименование/адрес/телефон/email) живьём из организации
   * участка — без чтения marketplace-детализации. Источник правды реквизитов
   * КУ: правит председатель в «Кооперативные участки», ПВЗ-детализация их не
   * хранит. Используется field-резолвером `MarketplaceKUDetails`.
   */
  async resolveBranchContacts(
    braname: string
  ): Promise<{ name: string | null; address: string | null; phone: string | null; email: string | null }> {
    if (!braname) return { name: null, address: null, phone: null, email: null };
    return this.orgDisplay(await this.safeOrg(braname));
  }

  /**
   * Батч реквизитов веток по `braname` (дедуп) для обогащения ленты заказов.
   * Наименование/адрес — из организации участка (live); координаты — из геокода
   * marketplace-детализации КУ (карта «куда ехать» на карточке заказа).
   */
  private async resolveBranches(
    branames: string[]
  ): Promise<Map<string, { name: string | null; address: string | null; lat: number | null; lng: number | null }>> {
    const result = new Map<
      string,
      { name: string | null; address: string | null; lat: number | null; lng: number | null }
    >();
    const unique = [...new Set(branames.filter((b) => b))];
    await Promise.all(
      unique.map(async (braname) => {
        result.set(braname, await this.resolveBranchDisplay(braname));
      })
    );
    return result;
  }

  /** Маппинг организации участка в отображаемые реквизиты (единый порядок fallback). */
  private orgDisplay(org: {
    short_name?: string;
    full_name?: string;
    fact_address?: string;
    full_address?: string;
    phone?: string;
    email?: string;
  } | null): { name: string | null; address: string | null; phone: string | null; email: string | null } {
    return {
      name: org?.short_name?.trim() || org?.full_name?.trim() || null,
      address: org?.fact_address?.trim() || org?.full_address?.trim() || null,
      phone: org?.phone?.trim() || null,
      email: org?.email?.trim() || null,
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
}
