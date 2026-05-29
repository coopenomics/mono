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
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import { MarketplaceOrderStatuses } from '../../domain/entities/marketplace-order.types';
import type { MarketplaceOrderStatus } from '../../domain/entities/marketplace-order.types';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type {
  MarketplaceBarcodeStrategy,
  MarketplaceOfferCycleType,
  MarketplaceOfferImage,
  MarketplaceOfferStatus,
  MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';
import {
  MARKETPLACE_OFFER_CYCLE_TYPES,
  MARKETPLACE_OFFER_MAX_IMAGES,
  MARKETPLACE_UNITS_OF_MEASURE,
  MarketplaceBarcodeStrategies,
  MarketplaceOfferCycleTypes,
} from '../../domain/entities/marketplace-offer.types';
import { MarketplaceOfferImagesService } from './marketplace-offer-images.service';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';

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
  cycle_type: MarketplaceOfferCycleType;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
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
 *   withdraw→ если ACTIVE/PENDING_MODERATION — status=WITHDRAWN;
 *             блокируется при наличии незакрытых Order'ов с понятным
 *             сообщением (заглушка `hasActiveOrders` — реализуется при
 *             merge Story 4.x, в MVP всегда false).
 *   republish→ WITHDRAWN → PENDING_MODERATION. Снятие не удаляет данные, поэтому
 *             вернуть предложение можно без пересоздания — снова на модерацию.
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
  public static readonly BASELINE_CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  /** Технический лимит — защита от опечатки в pack_size (Story 5.5 / 598-22). */
  public static readonly MAX_PACK_SIZE = 1000;

  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly repo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CATEGORY_REPOSITORY)
    private readonly categoryRepo: MarketplaceCategoryDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    private readonly imagesService: MarketplaceOfferImagesService
  ) {}

  /**
   * Не-терминальные статусы Order'а, при которых нельзя позволить
   * supplier'у withdraw'нуть Offer — у пайщика-orderer'а либо средства
   * заблокированы (ACTIVE/ACCEPTED_PENDING_*), либо заказ на КУ ожидает
   * выдачи (ACCEPTED/READY_TO_RECEIVE). Терминальные RECEIVED, CANCELLED
   * и EXPIRED — не мешают.
   */
  public static readonly WITHDRAW_BLOCKING_STATUSES = [
    MarketplaceOrderStatuses.ACTIVE,
    MarketplaceOrderStatuses.ACCEPTED_PENDING_SUPPLIER,
    MarketplaceOrderStatuses.ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL,
    MarketplaceOrderStatuses.ACCEPTED,
    MarketplaceOrderStatuses.ACCEPTED_TO_COOP,
    MarketplaceOrderStatuses.READY_TO_RECEIVE,
  ];

  async create(input: OfferCreateRequest): Promise<MarketplaceOfferDomainEntity> {
    this.validateCreateInput(input);
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
      cycle_type: input.cycle_type,
      cycle_days: input.cycle_days,
      target_volume: input.target_volume,
      max_wait_days: input.max_wait_days,
      min_threshold: input.min_threshold,
      warranty_days: input.warranty_days,
      barcode_strategy,
      pack_size,
      images,
    };

    try {
      return await this.repo.create(dbInput);
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
    if (patch.cycle_type !== undefined) {
      this.assertCycleType(patch.cycle_type);
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

    // Story 4.7: per-cycle_type обязательные поля. Если patch меняет cycle_type
    // или его cycle-specific параметры — валидируем по merged-снимку
    // (текущее значение из БД + patch). Иначе старый Offer остаётся
    // валидным после частичного редактирования других полей.
    const cycleFieldsTouched =
      patch.cycle_type !== undefined ||
      patch.cycle_days !== undefined ||
      patch.target_volume !== undefined ||
      patch.max_wait_days !== undefined;
    if (cycleFieldsTouched) {
      this.assertCycleConditionals({
        cycle_type: patch.cycle_type ?? offer.cycle_type,
        cycle_days: patch.cycle_days !== undefined ? patch.cycle_days : offer.cycle_days,
        target_volume: patch.target_volume !== undefined ? patch.target_volume : offer.target_volume,
        max_wait_days: patch.max_wait_days !== undefined ? patch.max_wait_days : offer.max_wait_days,
      });
    }

    // Поле-зависимая модерация. Операционные поля (остаток, цена) поставщик
    // меняет часто и без участия председателя — их правка НЕ снимает оффер с
    // публикации и не шлёт на повторную модерацию. Любое же изменение
    // «модерационно-значимого» контента (название, описание, категория,
    // фото, единица измерения, условия цикла, гарантия, штрихкод) — то, что
    // председатель видит и проверяет, — сбрасывает статус в PENDING_MODERATION.
    // requireOwnedEditable пропускает сюда ACTIVE, PENDING_MODERATION и
    // REJECTED. Для REJECTED любая правка — это исправление причины отклонения,
    // поэтому она всегда уходит на повторную модерацию (даже если тронули
    // только цену/остаток): оффер сейчас невидим в каталоге и должен снова
    // пройти проверку, чтобы опубликоваться.
    const NON_MODERATED_FIELDS: ReadonlyArray<keyof OfferUpdateInput> = [
      'price_per_unit',
      'quantity_available',
      'unlimited_flag',
    ];
    const touchedKeys = (Object.keys(patch) as Array<keyof OfferUpdateInput>).filter(
      (k) => patch[k] !== undefined,
    );
    const moderationSignificantChange =
      offer.status === 'REJECTED' ||
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
      // edit контента повторно отправляет оффер на модерацию — поля прошлых
      // решений (approve/reject) не должны утечь в UI как «уже одобрен» /
      // «отклонён с прошлой причиной».
      normalizedPatch.status = 'PENDING_MODERATION';
      normalizedPatch.approved_by = null;
      normalizedPatch.approved_at = null;
      normalizedPatch.rejected_by = null;
      normalizedPatch.rejected_at = null;
      normalizedPatch.reject_reason = null;
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
      return await this.repo.applyUpdate(offer.id, normalizedPatch);
    } catch (e) {
      if (newlyUploaded.length) await this.cleanupImages(newlyUploaded);
      throw e;
    }
  }

  async withdraw(id: string, supplier_account: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.requireOwnedEditable(id, supplier_account, ['withdraw']);

    if (await this.hasActiveOrders(offer.coopname, offer.id)) {
      throw new ConflictException(
        'Нельзя снять предложение: по нему есть незакрытые заказы. Сначала отмените или закройте их.'
      );
    }

    return this.repo.applyUpdate(offer.id, { status: 'WITHDRAWN' });
  }

  /**
   * Вернуть ранее снятое предложение на публикацию: WITHDRAWN →
   * PENDING_MODERATION. Снятие не удаляет данные оферты — все поля и
   * изображения на месте, поэтому пересоздавать ничего не нужно, достаточно
   * снова отправить на модерацию. Доступно только владельцу и только для
   * снятого предложения (REJECTED не возвращаем: его отклонил модератор по
   * причине — нужна правка, а не повторная отправка тех же данных).
   */
  async republish(id: string, supplier_account: string): Promise<MarketplaceOfferDomainEntity> {
    const offer = await this.repo.findById(id);
    if (!offer) {
      throw new NotFoundException('Предложение не найдено.');
    }
    if (offer.supplier_account !== supplier_account) {
      throw new ForbiddenException('Можно изменять только свои предложения.');
    }
    if (offer.status !== 'WITHDRAWN') {
      throw new ForbiddenException(
        'Вернуть на публикацию можно только снятое предложение.'
      );
    }
    return this.repo.applyUpdate(offer.id, { status: 'PENDING_MODERATION' });
  }

  async listMine(
    coopname: string,
    supplier_account: string,
    pagination: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MarketplaceOfferDomainEntity>> {
    return this.repo.list({ coopname, supplier_account }, pagination);
  }

  async getById(id: string): Promise<MarketplaceOfferDomainEntity | null> {
    return this.repo.findById(id);
  }

  private validateCreateInput(input: OfferCreateRequest): void {
    this.assertProductName(input.product_name);
    if (input.description !== null) this.assertDescription(input.description);
    this.assertUnit(input.unit_of_measure);
    this.assertCycleType(input.cycle_type);
    this.assertCycleConditionals({
      cycle_type: input.cycle_type,
      cycle_days: input.cycle_days,
      target_volume: input.target_volume,
      max_wait_days: input.max_wait_days,
    });

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
   * Story 4.7: required-поля per cycle_type (L11 Locked Decision).
   *
   *   time_based       → cycle_days REQUIRED (>=1); min_threshold optional
   *   volume_based     → target_volume + max_wait_days REQUIRED (>=1)
   *   open_subscription → max_wait_days optional; ничего required
   *   individual        → ничего required
   *
   * Если какое-то поле передано для «не своего» cycle_type — не ошибка,
   * просто будет проигнорировано репозиторием (FE может оставить старое
   * значение в форме при переключении типа). Главное — обязательные
   * заполнены и числа >= 1.
   */
  private assertCycleConditionals(input: {
    cycle_type: MarketplaceOfferCycleType;
    cycle_days: number | null;
    target_volume: number | null;
    max_wait_days: number | null;
  }): void {
    if (input.cycle_type === MarketplaceOfferCycleTypes.TIME_BASED) {
      if (input.cycle_days === null || input.cycle_days === undefined || input.cycle_days < 1) {
        throw new BadRequestException(
          'Для time_based укажите длительность цикла в днях (целое число от 1).'
        );
      }
    }
    if (input.cycle_type === MarketplaceOfferCycleTypes.VOLUME_BASED) {
      if (input.target_volume === null || input.target_volume === undefined || input.target_volume < 1) {
        throw new BadRequestException(
          'Для volume_based укажите целевой объём (целое число от 1).'
        );
      }
      if (input.max_wait_days === null || input.max_wait_days === undefined || input.max_wait_days < 1) {
        throw new BadRequestException(
          'Для volume_based укажите максимальный срок ожидания в днях (целое число от 1).'
        );
      }
    }
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

  private assertCycleType(t: MarketplaceOfferCycleType): void {
    if (!MARKETPLACE_OFFER_CYCLE_TYPES.includes(t)) {
      throw new BadRequestException('Выбран недопустимый тип цикла поставки.');
    }
  }

  private assertUnit(u: MarketplaceUnitOfMeasure): void {
    if (!MARKETPLACE_UNITS_OF_MEASURE.includes(u)) {
      throw new BadRequestException('Выбрана недопустимая единица измерения.');
    }
  }

  private async ensureCategoryExists(category_id: number): Promise<void> {
    if (!MarketplaceOfferService.BASELINE_CATEGORY_IDS.includes(category_id)) {
      throw new BadRequestException(
        `Выбрана недопустимая категория (${category_id}). Допустимы значения от 1 до 9.`
      );
    }
    const category = await this.categoryRepo.findById(category_id);
    if (!category) {
      throw new BadRequestException(
        `Категория с номером ${category_id} не найдена в справочнике. Обратитесь к администратору.`
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
      if (offer.status === 'WITHDRAWN' || offer.status === 'REJECTED') {
        const statusLabel = offer.status === 'WITHDRAWN' ? 'снято' : 'отклонено';
        throw new ForbiddenException(
          `Нельзя снять предложение, которое уже ${statusLabel}.`
        );
      }
    } else {
      // Редактировать можно ACTIVE / PENDING_MODERATION / REJECTED: отклонённое
      // правится для устранения причины и переотправки на модерацию (не
      // пересоздаётся заново). Снятое сначала возвращают на публикацию
      // (republish), затем редактируют.
      if (offer.status === 'WITHDRAWN') {
        throw new ForbiddenException(
          'Нельзя отредактировать снятое предложение. Сначала верните его на публикацию.'
        );
      }
    }
    return offer;
  }

  /**
   * Story 3.2: блокировка withdraw'а Offer'а при наличии незавершённых
   * Order'ов по нему. Проверяет все не-терминальные статусы
   * (WITHDRAW_BLOCKING_STATUSES) через `MarketplaceOrderDomainRepository.list`
   * с пагинацией 1×1 — нам нужен только factOfExistence (totalCount > 0).
   */
  private async hasActiveOrders(coopname: string, offer_id: string): Promise<boolean> {
    const probe = await this.orderRepo.list(
      {
        coopname,
        offer_id,
        status: MarketplaceOfferService.WITHDRAW_BLOCKING_STATUSES,
      },
      { page: 1, limit: 1, sortBy: 'created_at', sortOrder: 'DESC' }
    );
    return probe.totalCount > 0;
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
