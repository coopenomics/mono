import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
  type OfferCreateInput,
  type OfferUpdateInput,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_CATEGORY_REPOSITORY,
  type MarketplaceCategoryDomainRepository,
} from '../../domain/repositories/marketplace-category.repository';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type {
  MarketplaceOfferCycleType,
  MarketplaceOfferStatus,
  MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';
import {
  MARKETPLACE_OFFER_CYCLE_TYPES,
  MARKETPLACE_UNITS_OF_MEASURE,
} from '../../domain/entities/marketplace-offer.types';

export const MARKETPLACE_OFFER_SERVICE = Symbol('MARKETPLACE_OFFER_SERVICE');

export interface OfferCreateRequest {
  cooperative_id: string;
  supplier_account: string;
  vitrine_id: string;
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: MarketplaceUnitOfMeasure;
  quantity_available: number | null;
  unlimited_flag: boolean;
  cycle_type: MarketplaceOfferCycleType;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
}

/**
 * Story 3.2: жизненный цикл Offer'а у поставщика.
 *
 * Lifecycle (AC):
 *   create  → PENDING_MODERATION (rate-limit 10/час на supplier).
 *   edit    → если ACTIVE/PENDING_MODERATION — поля обновляются, status
 *             сбрасывается в PENDING_MODERATION; REJECTED edit → 403
 *             (поставщик должен создать новый offer, AC формулировка
 *             «создаст новый PENDING_MODERATION»); WITHDRAWN edit → 403.
 *   withdraw→ если ACTIVE/PENDING_MODERATION — status=WITHDRAWN;
 *             блокируется при наличии незакрытых Order'ов с понятным
 *             сообщением (заглушка `hasActiveOrders` — реализуется при
 *             merge Story 4.x, в MVP всегда false).
 *
 * Owner-проверка (`supplier_account == offer.supplier_account`) на уровне
 * сервиса — guard даёт capability, а не ownership.
 */
@Injectable()
export class MarketplaceOfferService {
  public static readonly RATE_LIMIT_PER_HOUR = 10;
  public static readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
  public static readonly MAX_PRODUCT_NAME_LEN = 200;
  public static readonly MAX_DESCRIPTION_LEN = 2000;
  public static readonly BASELINE_CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly repo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CATEGORY_REPOSITORY)
    private readonly categoryRepo: MarketplaceCategoryDomainRepository
  ) {}

  async create(input: OfferCreateRequest): Promise<MarketplaceOfferDomainEntity> {
    this.validateCreateInput(input);
    await this.ensureCategoryExists(input.category_id);
    await this.assertRateLimit(input.supplier_account);

    const dbInput: OfferCreateInput = {
      cooperative_id: input.cooperative_id,
      supplier_account: input.supplier_account,
      vitrine_id: input.vitrine_id,
      product_name: input.product_name.trim(),
      description: input.description?.trim() ?? null,
      category_id: input.category_id,
      price_per_unit: input.price_per_unit,
      unit_of_measure: input.unit_of_measure,
      quantity_available: input.unlimited_flag ? 0 : (input.quantity_available ?? 0),
      unlimited_flag: input.unlimited_flag,
      cycle_type: input.cycle_type,
      cycle_days: input.cycle_days,
      target_volume: input.target_volume,
      max_wait_days: input.max_wait_days,
      min_threshold: input.min_threshold,
      warranty_days: input.warranty_days,
    };

    return this.repo.create(dbInput);
  }

  async update(
    id: string,
    supplier_account: string,
    patch: OfferUpdateInput
  ): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.requireOwnedEditable(id, supplier_account, ['edit']);

    if (patch.product_name !== undefined) {
      this.assertProductName(patch.product_name);
    }
    if (patch.description !== undefined) {
      this.assertDescription(patch.description);
    }
    if (patch.category_id !== undefined) {
      await this.ensureCategoryExists(patch.category_id);
    }
    if (patch.cycle_type !== undefined) {
      this.assertCycleType(patch.cycle_type);
    }
    if (patch.unit_of_measure !== undefined) {
      this.assertUnit(patch.unit_of_measure);
    }
    if (patch.warranty_days !== undefined && patch.warranty_days < 0) {
      throw new BadRequestException('warranty_days не может быть отрицательным');
    }

    const normalizedPatch: OfferUpdateInput & { status: MarketplaceOfferStatus } = {
      ...patch,
      status: 'PENDING_MODERATION',
    };

    if (patch.unlimited_flag === true) {
      normalizedPatch.quantity_available = 0;
    }

    return this.repo.applyUpdate(offer.id, normalizedPatch);
  }

  async withdraw(id: string, supplier_account: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.requireOwnedEditable(id, supplier_account, ['withdraw']);

    if (await this.hasActiveOrders(offer.id)) {
      throw new ConflictException(
        'Offer нельзя снять: есть незакрытые Order\'ы. Отмените или закройте их перед withdraw.'
      );
    }

    return this.repo.applyUpdate(offer.id, { status: 'WITHDRAWN' });
  }

  async listMine(
    cooperative_id: string,
    supplier_account: string,
    paging: { limit: number; offset: number }
  ) {
    return this.repo.list({ cooperative_id, supplier_account }, paging);
  }

  async getById(id: string): Promise<MarketplaceOfferDomainEntity | null> {
    return this.repo.findById(id);
  }

  private validateCreateInput(input: OfferCreateRequest): void {
    this.assertProductName(input.product_name);
    if (input.description !== null) this.assertDescription(input.description);
    this.assertUnit(input.unit_of_measure);
    this.assertCycleType(input.cycle_type);

    if (!input.unlimited_flag) {
      if (input.quantity_available === null || input.quantity_available < 0) {
        throw new BadRequestException(
          'quantity_available обязателен и >= 0 при unlimited_flag=false'
        );
      }
    }

    if (input.warranty_days < 0) {
      throw new BadRequestException('warranty_days не может быть отрицательным');
    }

    if (typeof input.price_per_unit !== 'string' || !/^\d+(\.\d{1,4})?$/.test(input.price_per_unit)) {
      throw new BadRequestException(
        'price_per_unit должен быть строкой числа с до 4 знаков после точки (например "100.50")'
      );
    }
  }

  private assertProductName(name: string): void {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException('product_name обязателен');
    }
    if (trimmed.length > MarketplaceOfferService.MAX_PRODUCT_NAME_LEN) {
      throw new BadRequestException(
        `product_name должен быть ≤${MarketplaceOfferService.MAX_PRODUCT_NAME_LEN} символов`
      );
    }
  }

  private assertDescription(description: string | null): void {
    if (description === null) return;
    if (description.length > MarketplaceOfferService.MAX_DESCRIPTION_LEN) {
      throw new BadRequestException(
        `description должен быть ≤${MarketplaceOfferService.MAX_DESCRIPTION_LEN} символов`
      );
    }
  }

  private assertCycleType(t: MarketplaceOfferCycleType): void {
    if (!MARKETPLACE_OFFER_CYCLE_TYPES.includes(t)) {
      throw new BadRequestException(
        `Некорректный cycle_type: ${t}. Допустимы: ${MARKETPLACE_OFFER_CYCLE_TYPES.join(', ')}`
      );
    }
  }

  private assertUnit(u: MarketplaceUnitOfMeasure): void {
    if (!MARKETPLACE_UNITS_OF_MEASURE.includes(u)) {
      throw new BadRequestException(
        `Некорректный unit_of_measure: ${u}. Допустимы: ${MARKETPLACE_UNITS_OF_MEASURE.join(', ')}`
      );
    }
  }

  private async ensureCategoryExists(category_id: number): Promise<void> {
    if (!MarketplaceOfferService.BASELINE_CATEGORY_IDS.includes(category_id)) {
      throw new BadRequestException(
        `category_id ${category_id} вне baseline-набора 1..10`
      );
    }
    const category = await this.categoryRepo.findById(category_id);
    if (!category) {
      throw new BadRequestException(
        `Категория ${category_id} не найдена в справочнике (bootstrap-v4 не выполнен?)`
      );
    }
  }

  private async assertRateLimit(supplier_account: string): Promise<void> {
    const count = await this.repo.countRecentCreatedBy(
      supplier_account,
      MarketplaceOfferService.RATE_LIMIT_WINDOW_MS
    );
    if (count >= MarketplaceOfferService.RATE_LIMIT_PER_HOUR) {
      throw new BadRequestException(
        `Rate-limit: не более ${MarketplaceOfferService.RATE_LIMIT_PER_HOUR} Offer'ов в час на одного поставщика`
      );
    }
  }

  private async requireOwnedEditable(
    id: string,
    supplier_account: string,
    op: ['edit' | 'withdraw']
  ): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.repo.findById(id);
    if (!offer) {
      throw new NotFoundException(`Offer ${id} не найден`);
    }
    if (offer.supplier_account !== supplier_account) {
      throw new ForbiddenException('Можно изменять только собственные Offer\'ы');
    }
    if (offer.status === 'WITHDRAWN' || offer.status === 'REJECTED') {
      throw new ForbiddenException(
        `Operation '${op[0]}' недопустима для Offer'а в статусе ${offer.status}`
      );
    }
    return offer;
  }

  /**
   * Заглушка-точка интеграции с Эпиком 4 (PR #375 canonical actions
   * `o.mkt.assign/block/unblock`). До мерджа Эпика 4 в marketplace2
   * Order'ов нет — withdraw разрешён всегда. Story 4.x перепишет на
   * `OrderRepository.countActiveByOffer(offer_id)`.
   */
  private async hasActiveOrders(_offer_id: string): Promise<boolean> {
    return false;
  }
}
