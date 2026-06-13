import {
  BadRequestException,
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
  MarketplaceBarcodeStrategy,
  MarketplaceOfferDeliveryPoint,
  MarketplaceOfferImage,
  MarketplaceOfferStatus,
  MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';
import {
  MARKETPLACE_OFFER_MAX_IMAGES,
  MARKETPLACE_UNITS_OF_MEASURE,
  MarketplaceBarcodeStrategies,
  MarketplaceOfferStatuses,
} from '../../domain/entities/marketplace-offer.types';
import { MarketplaceOfferImagesService } from './marketplace-offer-images.service';
import {
  AVAILABLE_CATEGORY_DOMAIN_SERVICE,
  type AvailableCategoryDomainService,
} from '../../domain/services/available-category-domain.service';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import config from '~/config/config';
import {
  MARKETPLACE_OFFER_APPROVED_EVENT,
  MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT,
  type MarketplaceOfferApprovedEvent,
  type MarketplaceOfferModerationRequestedEvent,
} from '../events/marketplace-notification.events';
import {
  MARKETPLACE_SUPPLIER_SETTINGS_SERVICE,
  MarketplaceSupplierSettingsService,
} from './marketplace-supplier-settings.service';

export const MARKETPLACE_OFFER_SERVICE = Symbol('MARKETPLACE_OFFER_SERVICE');

/**
 * Сырой загружаемый файл изображения с фронта: содержимое в base64 + MIME.
 * Тот же контракт, что у фото гарантийного возврата (Story 7.1) — base64 в
 * GraphQL-инпуте, декодирование на backend. Сервис превращает его в
 * `MarketplaceOfferImage` (ключ bucket'а + sha256) до записи в БД.
 */
export interface MarketplaceOfferImageUpload {
  /** Новый файл: содержимое в base64. Взаимоисключимо с bucket_key. */
  base64?: string;
  mime_type?: string;
  /** Уже сохранённое изображение: сохранить его в наборе по ключу хранилища. */
  bucket_key?: string;
}

export interface OfferCreateRequest {
  coopname: string;
  supplier_account: string;
  vitrine_id: string;
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: MarketplaceUnitOfMeasure;
  quantity_available: number | null;
  unlimited_flag: boolean;
  /** КУ поставки с минимальным объёмом на каждом. */
  delivery_points: MarketplaceOfferDeliveryPoint[];
  warranty_days: number;
  barcode_strategy?: MarketplaceBarcodeStrategy | null;
  pack_size?: number | null;
  /** Изображения товара (base64). Порядок в массиве = порядок показа. */
  images?: MarketplaceOfferImageUpload[] | null;
}

/**
 * Story 3.2: жизненный цикл Offer'а у поставщика.
 *
 * Lifecycle (AC):
 *   create  → PENDING_MODERATION (rate-limit 10/час на supplier).
 *   edit    → ACTIVE/PENDING_MODERATION — поля обновляются (значимый контент
 *             сбрасывает status в PENDING_MODERATION); REJECTED — правка
 *             устраняет причину отклонения и всегда уходит на повторную
 *             модерацию (не пересоздаётся); WITHDRAWN edit → 403 (сначала
 *             republish).
 *   withdraw→ если ACTIVE/PENDING_MODERATION — status=WITHDRAWN. Снятие лишь
 *             убирает оффер из каталога (новые заказы не создаются); уже
 *             принятые/созданные Order'ы независимы и ведутся поставщиком
 *             отдельно, поэтому НЕ блокируют снятие.
 *   republish→ WITHDRAWN → ACTIVE, если оффер уже был одобрен (контент при
 *             снятии не менялся — проверять нечего); ещё не одобренный (снят с
 *             модерации) → PENDING_MODERATION. Без пересоздания: данные на месте.
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
  /** Технический лимит — защита от опечатки в pack_size (Story 5.5 / 598-22). */
  public static readonly MAX_PACK_SIZE = 1000;

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly repo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CATEGORY_REPOSITORY)
    private readonly categoryRepo: MarketplaceCategoryDomainRepository,
    @Inject(AVAILABLE_CATEGORY_DOMAIN_SERVICE)
    private readonly availableCategoryService: AvailableCategoryDomainService,
    private readonly imagesService: MarketplaceOfferImagesService,
    private readonly eventBus: EventEmitter2,
    @Inject(MARKETPLACE_SUPPLIER_SETTINGS_SERVICE)
    private readonly supplierSettings: MarketplaceSupplierSettingsService
  ) {}

  async create(input: OfferCreateRequest): Promise<MarketplaceOfferDomainEntity> {
    this.validateCreateInput(input);
    // Гейт публикации: без реквизитов для выплат предложение не публикуется —
    // выплата по будущему акту приёмки не должна рождаться «в никуда».
    // Публикация остатка кооперативом идёт мимо этого сервиса (offerRepo
    // напрямую в stock-сервисе) и под гейт не попадает.
    await this.supplierSettings.assertPayoutMethodConfigured(
      input.coopname,
      input.supplier_account
    );
    await this.ensureCategoryExists(input.category_id);
    await this.assertRateLimit(input.supplier_account);

    const barcode_strategy =
      input.barcode_strategy ?? MarketplaceBarcodeStrategies.PER_ORDER;
    const pack_size =
      barcode_strategy === MarketplaceBarcodeStrategies.PER_PACKAGE
        ? input.pack_size ?? null
        : null;

    const images = await this.uploadImages(
      input.coopname,
      input.supplier_account,
      input.images ?? []
    );

    const dbInput: OfferCreateInput = {
      coopname: input.coopname,
      supplier_account: input.supplier_account,
      vitrine_id: input.vitrine_id,
      product_name: input.product_name.trim(),
      description: input.description?.trim() ?? null,
      category_id: input.category_id,
      price_per_unit: input.price_per_unit,
      unit_of_measure: input.unit_of_measure,
      quantity_available: input.unlimited_flag ? 0 : (input.quantity_available ?? 0),
      unlimited_flag: input.unlimited_flag,
      delivery_points: this.normalizeDeliveryPoints(input.delivery_points),
      warranty_days: input.warranty_days,
      barcode_strategy,
      pack_size,
      images,
    };

    try {
      const created = await this.repo.create(dbInput);
      // Новое предложение рождается в PENDING_MODERATION — заявка должна
      // появиться на столе модерации сразу.
      this.emitModerationRequested(created.id, created.supplier_account);
      return created;
    } catch (e) {
      // Запись Offer'а не удалась — не оставляем загруженные файлы сиротами.
      await this.cleanupImages(images);
      throw e;
    }
  }

  async update(
    id: string,
    supplier_account: string,
    patch: OfferUpdateInput,
    images?: MarketplaceOfferImageUpload[]
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
    if (patch.delivery_points !== undefined) {
      this.assertDeliveryPoints(patch.delivery_points);
      patch.delivery_points = this.normalizeDeliveryPoints(patch.delivery_points);
    }
    if (patch.unit_of_measure !== undefined) {
      this.assertUnit(patch.unit_of_measure);
    }
    if (patch.warranty_days !== undefined && patch.warranty_days < 0) {
      throw new BadRequestException('Срок гарантии не может быть отрицательным.');
    }

    if (patch.barcode_strategy !== undefined || patch.pack_size !== undefined) {
      const merged_strategy = patch.barcode_strategy ?? offer.barcode_strategy;
      const merged_pack_size =
        patch.pack_size !== undefined ? patch.pack_size : offer.pack_size;
      this.assertBarcodeConfig(merged_strategy, merged_pack_size);
      if (merged_strategy !== MarketplaceBarcodeStrategies.PER_PACKAGE && patch.pack_size === undefined) {
        // При переключении на стратегию не-PER_PACKAGE — pack_size сбрасывается,
        // чтобы не оставлять висящее значение, которое потом смутит модерацию.
        patch.pack_size = null;
      }
    }

    // Поле-зависимая модерация. Операционные поля (остаток, цена) поставщик
    // меняет часто и без участия председателя — их правка НЕ снимает оффер с
    // публикации и не шлёт на повторную модерацию. Любое же изменение
    // «модерационно-значимого» контента (название, описание, категория,
    // фото, единица измерения, условия цикла, гарантия, штрихкод) — то, что
    // председатель видит и проверяет, — сбрасывает статус в PENDING_MODERATION
    // (кроме WITHDRAWN — см. ниже). requireOwnedEditable пропускает сюда любой
    // не-удалённый статус. Для REJECTED любая правка — это исправление причины
    // отклонения, поэтому она всегда уходит на повторную модерацию (даже если
    // тронули только цену/остаток): оффер сейчас невидим в каталоге и должен
    // снова пройти проверку, чтобы опубликоваться.
    const NON_MODERATED_FIELDS: ReadonlyArray<keyof OfferUpdateInput> = [
      'price_per_unit',
      'quantity_available',
      'unlimited_flag',
    ];
    const touchedKeys = (Object.keys(patch) as Array<keyof OfferUpdateInput>).filter(
      (k) => patch[k] !== undefined,
    );
    const moderationSignificantChange =
      offer.status === MarketplaceOfferStatuses.REJECTED ||
      images !== undefined ||
      touchedKeys.some((k) => !NON_MODERATED_FIELDS.includes(k));

    const normalizedPatch: OfferUpdateInput & {
      status?: MarketplaceOfferStatus;
      approved_by?: string | null;
      approved_at?: Date | null;
      rejected_by?: string | null;
      rejected_at?: Date | null;
      reject_reason?: string | null;
    } = { ...patch };

    if (moderationSignificantChange) {
      // Значимая правка контента аннулирует прошлые решения модератора —
      // approve/reject не должны утечь в UI как «уже одобрен»/«отклонён с
      // прошлой причиной». Сброс `approved_at` также гарантирует, что
      // последующий republish уйдёт на модерацию (контент изменился).
      normalizedPatch.approved_by = null;
      normalizedPatch.approved_at = null;
      normalizedPatch.rejected_by = null;
      normalizedPatch.rejected_at = null;
      normalizedPatch.reject_reason = null;
      // Снятую (WITHDRAWN) правка В КАТАЛОГ НЕ ВОЗВРАЩАЕТ — статус остаётся
      // WITHDRAWN до явного republish; на модерацию она попадёт уже при
      // возврате на публикацию. Остальные статусы при значимой правке уходят
      // на повторную модерацию сразу (оффер виден/ожидает — должен пройти
      // проверку перед показом).
      if (offer.status !== MarketplaceOfferStatuses.WITHDRAWN) {
        normalizedPatch.status = MarketplaceOfferStatuses.PENDING_MODERATION;
      }
    }

    if (patch.unlimited_flag === true) {
      normalizedPatch.quantity_available = 0;
    }

    // Изображения переданы → пересобираем набор: элементы с bucket_key —
    // сохраняем как есть (пользователь оставил уже загруженное), элементы с
    // base64 — грузим как новые. Порядок = порядок показа, первый = обложка.
    // Удалённые (не попавшие в набор) объекты bucket'а не подчищаем
    // (orphan-cleanup — вне MVP). При провале записи чистим ТОЛЬКО что
    // загруженные — сохранённые существующие трогать нельзя.
    let newlyUploaded: MarketplaceOfferImage[] = [];
    if (images !== undefined) {
      const resolved = await this.resolveImagesForUpdate(offer, supplier_account, images);
      newlyUploaded = resolved.newlyUploaded;
      normalizedPatch.images = resolved.images;
    }

    try {
      const updated = await this.repo.applyUpdate(offer.id, normalizedPatch);
      // Значимая правка вернула предложение на модерацию — очередь
      // председателя должна показать повторную заявку сразу.
      if (normalizedPatch.status === MarketplaceOfferStatuses.PENDING_MODERATION) {
        this.emitModerationRequested(updated.id, updated.supplier_account);
      }
      return updated;
    } catch (e) {
      if (newlyUploaded.length) await this.cleanupImages(newlyUploaded);
      throw e;
    }
  }

  async withdraw(id: string, supplier_account: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.requireOwnedEditable(id, supplier_account, ['withdraw']);

    // Снятие лишь убирает предложение из каталога — новые заказы по нему больше
    // не создаются. Уже принятые/созданные заказы независимы от статуса оферты:
    // поставщик продолжает их вести (принять/отклонить партию) отдельно. Поэтому
    // незакрытые заказы НЕ блокируют снятие — иначе оффер «залипает» в каталоге,
    // пока висит хоть один незавершённый заказ.
    return this.repo.applyUpdate(offer.id, {
      status: MarketplaceOfferStatuses.WITHDRAWN,
    });
  }

  /**
   * Вернуть ранее снятое предложение на публикацию. Снятие не удаляет данные
   * оферты и не меняет её контент — все поля и изображения остаются теми же,
   * что были до снятия, поэтому пересоздавать ничего не нужно. Доступно только
   * владельцу и только для снятого предложения (REJECTED не возвращаем: его
   * отклонил модератор по причине — нужна правка, а не повторная отправка тех
   * же данных).
   *
   * Поскольку контент при снятии гарантированно не менялся, повторная модерация
   * нужна, только если оффер ещё НИ РАЗУ не одобрялся (его сняли прямо с
   * модерации). Если же председатель его уже одобрял (`approved_at` стоит) —
   * возвращаем сразу в ACTIVE без повторной проверки: проверять нечего, данные
   * те же, что председатель уже видел. Это та же поле-зависимая логика, что и в
   * `update` (контент не тронут → модерация не сбрасывается).
   */
  async republish(id: string, supplier_account: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.repo.findById(id);
    if (!offer) {
      throw new NotFoundException('Предложение не найдено.');
    }
    if (offer.supplier_account !== supplier_account) {
      throw new ForbiddenException('Можно изменять только свои предложения.');
    }
    if (offer.status !== MarketplaceOfferStatuses.WITHDRAWN) {
      throw new ForbiddenException(
        'Вернуть на публикацию можно только снятое предложение.'
      );
    }
    // Тот же гейт, что и при создании: за время простоя поставщик мог удалить
    // реквизиты — возвращать предложение в каталог без них нельзя.
    await this.supplierSettings.assertPayoutMethodConfigured(
      offer.coopname,
      supplier_account
    );
    const wasApproved = offer.approved_at != null;
    const updated = await this.repo.applyUpdate(offer.id, {
      status: wasApproved
        ? MarketplaceOfferStatuses.ACTIVE
        : MarketplaceOfferStatuses.PENDING_MODERATION,
    });
    // republish ранее одобренного оффера возвращает его в каталог МИНУЯ
    // модерацию — даём тот же сигнал «появилось в каталоге», что и approve,
    // чтобы живая витрина показала вернувшееся предложение. На повторную
    // модерацию (нет approved_at) сигнал даст уже модератор при approve.
    if (wasApproved) {
      const event: MarketplaceOfferApprovedEvent = {
        offer_id: updated.id,
        supplier_account: updated.supplier_account,
        approved_by: updated.approved_by ?? supplier_account,
        category_id: updated.category_id,
      };
      this.eventBus.emit(MARKETPLACE_OFFER_APPROVED_EVENT, event);
    } else {
      this.emitModerationRequested(updated.id, updated.supplier_account);
    }
    return updated;
  }

  /**
   * Realtime-сигнал «предложение ждёт модерации» — стол председателя
   * перечитывает очередь сразу, без поллинга. Эмитится ПОСЛЕ commit'а в PG
   * (INV-12); маршрутизация по каналу модерации — в realtime-мосте.
   */
  private emitModerationRequested(offer_id: string, supplier_account: string): void {
    const event: MarketplaceOfferModerationRequestedEvent = { offer_id, supplier_account };
    this.eventBus.emit(MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT, event);
  }

  async listMine(
    coopname: string,
    supplier_account: string,
    pagination: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MarketplaceOfferDomainEntity>> {
    return this.repo.list({ coopname, supplier_account }, pagination);
  }

  // Реестр всех предложений кооператива (стол администратора): любой статус
  // и любой поставщик, с опциональными фильтрами по статусу и поставщику.
  async listAll(
    coopname: string,
    filter: { statuses?: MarketplaceOfferStatus[]; supplier_account?: string },
    pagination: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MarketplaceOfferDomainEntity>> {
    return this.repo.list(
      {
        coopname,
        ...(filter.supplier_account ? { supplier_account: filter.supplier_account } : {}),
        ...(filter.statuses?.length ? { status: filter.statuses } : {}),
      },
      pagination
    );
  }

  async getById(id: string): Promise<MarketplaceOfferDomainEntity | null> {
    return this.repo.findById(id);
  }

  private validateCreateInput(input: OfferCreateRequest): void {
    this.assertProductName(input.product_name);
    if (input.description !== null) this.assertDescription(input.description);
    this.assertUnit(input.unit_of_measure);
    this.assertDeliveryPoints(input.delivery_points);

    if (!input.unlimited_flag) {
      if (input.quantity_available === null || input.quantity_available < 0) {
        throw new BadRequestException(
          'Укажите количество товара (целое неотрицательное число) или включите «без ограничения».'
        );
      }
    }

    if (input.warranty_days < 0) {
      throw new BadRequestException('Срок гарантии не может быть отрицательным.');
    }

    if (input.barcode_strategy !== undefined && input.barcode_strategy !== null) {
      this.assertBarcodeConfig(input.barcode_strategy, input.pack_size ?? null);
    } else if (input.pack_size !== undefined && input.pack_size !== null) {
      // pack_size без strategy не имеет смысла.
      throw new BadRequestException(
        'Размер упаковки указан, но стратегия маркировки не выбрана — выберите «по упаковке» (PER_PACKAGE).'
      );
    }

    if (typeof input.price_per_unit !== 'string' || !/^\d+(\.\d{1,4})?$/.test(input.price_per_unit)) {
      throw new BadRequestException(
        'Цена должна быть числом с не более чем четырьмя знаками после запятой (например, «100.50»).'
      );
    }
  }

  /**
   * Эпик 15: КУ поставки с минимальным объёмом. Управление поставкой целиком
   * сводится к этому набору — тип поставки как сущность упразднён. Минимум один
   * участок (иначе оффер некуда заказывать); braname непустой и уникальный в
   * наборе; min_supply_volume — целое ≥ 1. Существование КУ в кооперативе
   * дополнительно проверяется on-chain в createorder (`get_branch_or_fail`).
   */
  private assertDeliveryPoints(points: MarketplaceOfferDeliveryPoint[] | undefined): void {
    if (!Array.isArray(points) || points.length === 0) {
      throw new BadRequestException('Укажите хотя бы один кооперативный участок поставки.');
    }
    const seen = new Set<string>();
    for (const p of points) {
      const braname = (p?.braname ?? '').trim();
      if (!braname) {
        throw new BadRequestException('У точки поставки не указан кооперативный участок.');
      }
      if (seen.has(braname)) {
        throw new BadRequestException(`Кооперативный участок «${braname}» указан в поставке дважды.`);
      }
      seen.add(braname);
      if (!Number.isInteger(p.min_supply_volume) || p.min_supply_volume < 1) {
        throw new BadRequestException(
          `Минимальный объём для участка «${braname}» должен быть целым числом от 1.`
        );
      }
    }
  }

  private normalizeDeliveryPoints(
    points: MarketplaceOfferDeliveryPoint[] | undefined
  ): MarketplaceOfferDeliveryPoint[] {
    return (points ?? []).map((p) => ({
      braname: p.braname.trim(),
      min_supply_volume: p.min_supply_volume,
    }));
  }

  private assertProductName(name: string): void {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException('Укажите название товара.');
    }
    if (trimmed.length > MarketplaceOfferService.MAX_PRODUCT_NAME_LEN) {
      throw new BadRequestException(
        `Название товара слишком длинное (максимум ${MarketplaceOfferService.MAX_PRODUCT_NAME_LEN} символов).`
      );
    }
  }

  private assertDescription(description: string | null): void {
    if (description === null) return;
    if (description.length > MarketplaceOfferService.MAX_DESCRIPTION_LEN) {
      throw new BadRequestException(
        `Описание слишком длинное (максимум ${MarketplaceOfferService.MAX_DESCRIPTION_LEN} символов).`
      );
    }
  }

  /**
   * Story 5.5 / техдолг 598-22: barcode_strategy = PER_PACKAGE требует
   * pack_size в диапазоне [1, MAX_PACK_SIZE]. Прочие стратегии
   * запрещают непустой pack_size — он бы остался hanging value.
   */
  private assertBarcodeConfig(
    strategy: MarketplaceBarcodeStrategy,
    pack_size: number | null
  ): void {
    if (strategy === MarketplaceBarcodeStrategies.PER_PACKAGE) {
      if (pack_size === null || pack_size === undefined || pack_size < 1) {
        throw new BadRequestException(
          'Для стратегии «по упаковке» укажите размер упаковки (целое число от 1).'
        );
      }
      if (pack_size > MarketplaceOfferService.MAX_PACK_SIZE) {
        throw new BadRequestException(
          `Размер упаковки слишком велик (максимум ${MarketplaceOfferService.MAX_PACK_SIZE}). Проверьте, что вы указали именно единиц на упаковку.`
        );
      }
      return;
    }
    if (pack_size !== null && pack_size !== undefined) {
      throw new BadRequestException(
        'Размер упаковки применим только к стратегии «по упаковке» (PER_PACKAGE).'
      );
    }
  }

  private assertUnit(u: MarketplaceUnitOfMeasure): void {
    if (!MARKETPLACE_UNITS_OF_MEASURE.includes(u)) {
      throw new BadRequestException('Выбрана недопустимая единица измерения.');
    }
  }

  private async ensureCategoryExists(category_id: number): Promise<void> {
    // Категория должна принадлежать списку кооператива (общая baseline ИЛИ
    // собственная категория этого кооператива) — кастомные имеют id > 9.
    const coopCategories = await this.categoryRepo.listForCoop(config.coopname);
    const category = coopCategories.find((c) => c.id === category_id);
    if (!category) {
      throw new BadRequestException(
        `Категория с номером ${category_id} не найдена в справочнике кооператива. Обновите страницу или обратитесь к администратору.`
      );
    }
    // Категория должна быть доступна для публикации (включена в whitelist).
    // Пустой whitelist = открытый каталог: доступны все категории.
    const isAvailable = await this.availableCategoryService.isCategoryAvailable(
      config.coopname,
      category_id
    );
    if (!isAvailable) {
      throw new BadRequestException(
        `Категория «${category.display_name}» сейчас недоступна для публикации в этом кооперативе.`
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
        `Превышен лимит создания предложений: не более ${MarketplaceOfferService.RATE_LIMIT_PER_HOUR} в час на одного поставщика. Попробуйте позже.`
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
      throw new NotFoundException('Предложение не найдено.');
    }
    if (offer.supplier_account !== supplier_account) {
      throw new ForbiddenException('Можно изменять только свои предложения.');
    }
    if (op[0] === 'withdraw') {
      // Снять можно только опубликованное/ожидающее. Уже снятое или
      // отклонённое снимать нечего.
      if (
        offer.status === MarketplaceOfferStatuses.WITHDRAWN ||
        offer.status === MarketplaceOfferStatuses.REJECTED
      ) {
        const statusLabel =
          offer.status === MarketplaceOfferStatuses.WITHDRAWN ? 'снято' : 'отклонено';
        throw new ForbiddenException(
          `Нельзя снять предложение, которое уже ${statusLabel}.`
        );
      }
    }
    // Редактировать можно в любом не-удалённом статусе: ACTIVE/PENDING_MODERATION
    // правятся как обычно; REJECTED — для устранения причины и переотправки на
    // модерацию; WITHDRAWN — поставщик дорабатывает снятую карточку перед
    // возвратом на публикацию (статус остаётся WITHDRAWN, см. `update`).
    return offer;
  }


  /**
   * Декодирует base64-файлы и грузит их в bucket `stol-zakazov:images`,
   * возвращая доменные снапшоты (ключ + sha256 + mime). Сохраняет порядок
   * (индекс 0 = обложка). При провале загрузки одного из файлов — чистит уже
   * загруженные, чтобы не плодить сирот, и пробрасывает понятную ошибку.
   */
  /**
   * Пересборка набора изображений при редактировании. Каждый элемент — либо
   * ссылка на уже сохранённое изображение (bucket_key — оставляем как есть),
   * либо новый файл (base64 — грузим). Возвращает финальный упорядоченный
   * набор и отдельно перечень только что загруженных (для отката при провале
   * записи Offer'а). Чужой/неизвестный bucket_key отклоняем — сослаться можно
   * только на изображение текущего предложения.
   */
  private async resolveImagesForUpdate(
    offer: MarketplaceOfferDomainEntity,
    supplier_account: string,
    raw: MarketplaceOfferImageUpload[]
  ): Promise<{ images: MarketplaceOfferImage[]; newlyUploaded: MarketplaceOfferImage[] }> {
    if (raw.length > MARKETPLACE_OFFER_MAX_IMAGES) {
      throw new BadRequestException(
        `Слишком много изображений: максимум ${MARKETPLACE_OFFER_MAX_IMAGES} на одно предложение.`
      );
    }
    const existingByKey = new Map(
      (offer.images ?? []).map((img) => [img.bucket_key, img])
    );
    const images: MarketplaceOfferImage[] = [];
    const newlyUploaded: MarketplaceOfferImage[] = [];
    try {
      for (const item of raw) {
        if (item.bucket_key) {
          const kept = existingByKey.get(item.bucket_key);
          if (!kept) {
            throw new BadRequestException(
              'Неизвестное изображение: сослаться можно только на собственные изображения этого предложения.'
            );
          }
          images.push(kept);
          continue;
        }
        if (!item.base64) {
          throw new BadRequestException('Пустое изображение: отсутствует содержимое файла.');
        }
        const bytes = Buffer.from(item.base64, 'base64');
        if (bytes.length === 0) {
          throw new BadRequestException('Не удалось декодировать изображение (пустые данные).');
        }
        const image = await this.imagesService.putImage({
          bytes,
          contentType: item.mime_type as string,
          coopname: offer.coopname,
          ownerAccount: supplier_account,
        });
        newlyUploaded.push(image);
        images.push(image);
      }
      return { images, newlyUploaded };
    } catch (e) {
      await this.cleanupImages(newlyUploaded);
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        `Не удалось загрузить изображение: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  private async uploadImages(
    coopname: string,
    supplier_account: string,
    raw: MarketplaceOfferImageUpload[]
  ): Promise<MarketplaceOfferImage[]> {
    if (raw.length === 0) return [];
    if (raw.length > MARKETPLACE_OFFER_MAX_IMAGES) {
      throw new BadRequestException(
        `Слишком много изображений: максимум ${MARKETPLACE_OFFER_MAX_IMAGES} на одно предложение.`
      );
    }

    const result: MarketplaceOfferImage[] = [];
    try {
      for (const file of raw) {
        if (!file.base64 || !file.mime_type) {
          throw new BadRequestException('Пустое изображение: отсутствует содержимое файла.');
        }
        const bytes = Buffer.from(file.base64, 'base64');
        if (bytes.length === 0) {
          throw new BadRequestException('Не удалось декодировать изображение (пустые данные).');
        }
        const image = await this.imagesService.putImage({
          bytes,
          contentType: file.mime_type,
          coopname,
          ownerAccount: supplier_account,
        });
        result.push(image);
      }
      return result;
    } catch (e) {
      await this.cleanupImages(result);
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        `Не удалось загрузить изображение: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /** Best-effort удаление загруженных объектов (на провале записи Offer'а). */
  private async cleanupImages(images: MarketplaceOfferImage[]): Promise<void> {
    await Promise.all(
      images.map((img) => this.imagesService.deleteImage(img.bucket_key).catch(() => undefined))
    );
  }
}
