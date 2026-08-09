import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Cooperative } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, DOCUMENT_PORT, type IDocumentPort } from '@coopenomics/innercoop';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY,
  type MarketplaceConsolidatedRequestDomainRepository,
} from '../../domain/repositories/marketplace-consolidated-request.repository';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_SHIPMENT_REPOSITORY,
  type MarketplaceShipmentDomainRepository,
} from '../../domain/repositories/marketplace-shipment.repository';
import {
  MARKETPLACE_SUPPLY_VALIDATION_LOG_REPOSITORY,
  type MarketplaceSupplyValidationLogDomainRepository,
} from '../../domain/repositories/marketplace-supply-validation-log.repository';
import {
  MARKETPLACE_TTN_DOCUMENT_REPOSITORY,
  type MarketplaceTtnDocumentDomainRepository,
} from '../../domain/repositories/marketplace-ttn-document.repository';
import {
  MarketplaceShipmentDeliveryVariants,
  MarketplaceShipmentStatuses,
  type MarketplaceShipmentDeliveryVariant,
  type MarketplaceShipmentTTNData,
} from '../../domain/entities/marketplace-shipment.types';
import {
  MarketplaceSupplyValidationOutcomes,
  MarketplaceSupplyValidationReasons,
  type MarketplaceSupplyValidationReason,
} from '../../domain/entities/marketplace-supply-validation-log.types';
import type { MarketplaceShipmentDomainEntity } from '../../domain/entities/marketplace-shipment.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';

/** Группа доставки одного поставщика на один КУ = одна партия. */
export interface MarketplaceShipmentGroupInput {
  braname: string;
  delivery_variant: MarketplaceShipmentDeliveryVariant;
  /** Только для Варианта Б — поля ТТН (form-input от поставщика). */
  ttn_data?: MarketplaceShipmentTTNData | null;
  /**
   * Подмножество заказов КУ, реально погружаемых в партию (частичная отгрузка).
   * null/пусто → все акцептованные заказы этого КУ. Невключённые остаются ACCEPTED.
   */
  order_ids?: string[] | null;
}

export interface MarketplaceShipmentCreateInputDto {
  coopname: string;
  /** Поставщик-инициатор (account из core-сессии). */
  offerer_account: string;
  /** ID консолидированной заявки в статусе ACCEPTED. */
  cycle_id: string;
  /** Группы доставки. По одной per braname; не пересекаются. */
  groups: MarketplaceShipmentGroupInput[];
}

export interface MarketplaceShipmentCreateResult {
  shipments: MarketplaceShipmentDomainEntity[];
}

/**
 * Story 5.1 + 5.2: создание Shipment'ов из консолидированной заявки в
 * статусе ACCEPTED. Жёстко акцептует состав поставки (Story 5.2) перед
 * формированием групп; при rejection пишет запись в
 * `marketplace_supply_validation_log` и кидает BadRequestException с
 * читаемым reason'ом.
 *
 * Поведение:
 *   1. Загружает консолидированную заявку → проверяет ACCEPTED + ownership.
 *   2. Загружает все Order'ы заявки → жёсткая валидация состава.
 *   3. Транзакционно создаёт Shipment per группа + переводит Order'ы
 *      группы в SUPPLY_PREPARED (через applyStatusTransition).
 *   4. Для Варианта Б генерирует уникальный ttn_number (формат «ТТН-<12hex>»).
 *
 * Сам документ ТТН ПОКА генерируется на фронте на лету (desktop
 * `TTNPrintPreview` из shipment+orders), НЕ через document-factory: ТТН
 * экспедитора не подписывается ЭЦП и не публикуется в общий реестр документов
 * кооператива, поэтому рендерить и хранить HTML на бэкенде незачем. Фабричный
 * путь (registry_id=1103 + `generateAndStoreTtnDocument`) и реестр
 * `marketplace_ttn_document` оставлены на будущее, но не вызываются —
 * единый источник генерации ТТН сейчас фронтовый, чтобы не дублировать логику.
 */
@Injectable()
export class MarketplaceShipmentCreateService {
  constructor(
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY)
    private readonly cycleRepo: MarketplaceConsolidatedRequestDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    private readonly shipmentRepo: MarketplaceShipmentDomainRepository,
    @Inject(MARKETPLACE_SUPPLY_VALIDATION_LOG_REPOSITORY)
    private readonly logRepo: MarketplaceSupplyValidationLogDomainRepository,
    @Inject(MARKETPLACE_TTN_DOCUMENT_REPOSITORY)
    private readonly ttnRepo: MarketplaceTtnDocumentDomainRepository,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceShipmentCreateService.name);
  }

  async execute(input: MarketplaceShipmentCreateInputDto): Promise<MarketplaceShipmentCreateResult> {
    this.validateInputShape(input);

    // ── 1. Заявка существует + ACCEPTED + ownership ─────────────────
    const cycle = await this.cycleRepo.findById(input.cycle_id);
    if (!cycle) {
      throw new NotFoundException('Консолидированная заявка не найдена.');
    }
    if (cycle.coopname !== input.coopname) {
      throw new ForbiddenException('Заявка принадлежит другому кооперативу.');
    }
    if (cycle.supplier_account !== input.offerer_account) {
      throw new ForbiddenException('Партию формирует только поставщик заявки.');
    }
    if (cycle.status !== 'ACCEPTED') {
      await this.logRejection(
        input,
        MarketplaceSupplyValidationReasons.CYCLE_NOT_ACCEPTED,
        `Заявка в статусе ${cycle.status}; партии можно формировать только из ACCEPTED.`
      );
      throw new BadRequestException(
        `Состав поставки не соответствует акцептованной заявке: заявка в статусе ${cycle.status}.`
      );
    }

    // ── 2. Order'ы заявки + резолв состава каждой группы ──────────
    const cycleOrders = await this.orderRepo.findByCycleId(cycle.coopname, cycle.id);
    if (cycleOrders.length === 0) {
      await this.logRejection(
        input,
        MarketplaceSupplyValidationReasons.EMPTY_GROUPS,
        'В заявке нет Order\'ов.'
      );
      throw new BadRequestException(
        'Состав поставки не соответствует акцептованной заявке: в заявке нет Order\'ов.'
      );
    }

    // Резолвим состав каждой группы независимо (покрытие всех КУ заявки НЕ
    // требуется — частичная отгрузка и догрузка остатка допустимы). Повторное
    // формирование по заявке разрешено: guard `shipment_id IS NULL` в
    // assignToShipment не даст включить один заказ в две партии.
    const resolvedGroups = await this.resolveGroups(input, cycleOrders);

    // ── 3. Создание Shipment'ов + привязка Order'ов в SUPPLY_PREPARED ─
    const created: MarketplaceShipmentDomainEntity[] = [];
    for (const { group, orders: groupOrders } of resolvedGroups) {
      const groupAmount = this.sumAmount(groupOrders);
      const ttnNumber =
        group.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR
          ? this.computeTTNNumber()
          : null;

      const shipment = await this.shipmentRepo.create({
        coopname: cycle.coopname,
        cycle_id: cycle.id,
        offerer_account: cycle.supplier_account,
        braname: group.braname,
        delivery_variant: group.delivery_variant,
        total_amount: groupAmount,
        ttn_number: ttnNumber,
        ttn_data: group.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR ? group.ttn_data ?? null : null,
        ttn_document_id: null,
        status: MarketplaceShipmentStatuses.SUPPLY_PREPARED,
      });

      // ТТН (Вариант Б) ПОКА генерируется только на фронте на лету
      // (desktop `TTNPrintPreview` из данных партии/заказов), а НЕ через
      // document-factory. Причина: ТТН экспедитора не подписывается ЭЦП и не
      // публикуется в общий реестр документов кооператива — хранить отрендеренный
      // HTML незачем (фронт всегда пересоберёт его из shipment+orders). Чтобы не
      // дублировать логику генерации в двух местах, фабричный путь (registry 1103
      // + `generateAndStoreTtnDocument`) сейчас НЕ вызывается; `ttn_number`
      // по-прежнему выпускается выше и используется фронтом. Метод и реестр
      // оставлены на будущее — если ТТН пойдёт в реестр с подписями.
      // `ttn_document_id` остаётся null (ни приёмка, ни UI от него не зависят).

      // Заказы группы → привязка к партии + SUPPLY_PREPARED одним bulk-апдейтом.
      // Guard `shipment_id IS NULL` отсекает заказы, уже включённые в другую
      // партию (частичные отгрузки / догрузка остатка не пересекаются).
      const assigned = await this.orderRepo.assignToShipment(
        groupOrders.map((o) => o.id),
        shipment.id,
        `Партия #${shipment.id} (вариант ${group.delivery_variant})`
      );
      if (assigned !== groupOrders.length) {
        this.logger.warn(
          `Shipment ${shipment.id}: привязано ${assigned} из ${groupOrders.length} заказов (часть уже в другой партии).`
        );
      }

      created.push(shipment);
      this.logger.log(
        `Shipment ${shipment.id} создан для cycle=${cycle.id}, ku=${group.braname}, вариант=${group.delivery_variant}, orders=${groupOrders.length}`
      );
    }

    await this.logRepo.create({
      coopname: cycle.coopname,
      cycle_id: cycle.id,
      offerer_account: cycle.supplier_account,
      outcome: MarketplaceSupplyValidationOutcomes.OK,
      reason: null,
      reason_code: null,
      attempted_groups: input.groups,
    });

    return { shipments: created };
  }

  // ── private ──

  private validateInputShape(input: MarketplaceShipmentCreateInputDto): void {
    if (!input.coopname || !input.offerer_account || !input.cycle_id) {
      throw new BadRequestException('Параметры coopname / offerer_account / cycle_id обязательны.');
    }
    if (!input.groups || input.groups.length === 0) {
      throw new BadRequestException('Не задано ни одной группы доставки.');
    }
    for (const g of input.groups) {
      if (!g.braname) {
        throw new BadRequestException('У одной из групп не указан braname.');
      }
      if (
        g.delivery_variant !== MarketplaceShipmentDeliveryVariants.SELF &&
        g.delivery_variant !== MarketplaceShipmentDeliveryVariants.EXPEDITOR
      ) {
        throw new BadRequestException(`Недопустимый вариант доставки: ${String(g.delivery_variant)}.`);
      }
      if (g.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR) {
        this.assertTTNData(g.ttn_data);
      }
      if (g.order_ids != null) {
        if (!Array.isArray(g.order_ids)) {
          throw new BadRequestException(`order_ids группы КУ "${g.braname}" должен быть массивом.`);
        }
        if (g.order_ids.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
          throw new BadRequestException(`order_ids группы КУ "${g.braname}" содержит пустой идентификатор.`);
        }
      }
    }
  }

  // Правка 2026-06-07: поля ТТН необязательны. Поставщик формирует накладную с
  // тем, что известно (минимум — пусто), и отдаёт её перевозчику; незаполненное
  // просто не попадает в документ. Backend не требует ни одного поля — только
  // проверяет тип, если объект передан.
  private assertTTNData(ttn: MarketplaceShipmentTTNData | null | undefined): void {
    if (ttn != null && typeof ttn !== 'object') {
      throw new BadRequestException('ttn_data должен быть объектом.');
    }
  }

  /**
   * Резолв состава каждой группы доставки (одна группа = одна партия).
   *
   * Покрытие всех КУ заявки НЕ требуется (частичная отгрузка): валидируем
   * только указанные группы. Для каждой группы:
   *   - braname обязан присутствовать в заявке;
   *   - если задан `order_ids` — берём это подмножество (все id должны
   *     принадлежать КУ и быть в статусе ACCEPTED, иначе reject);
   *   - иначе — все ACCEPTED-заказы КУ (поведение по умолчанию).
   * Заказы вне статуса ACCEPTED (уже включённые в другую партию) в состав не
   * попадают; пустой результат по группе — reject.
   */
  private async resolveGroups(
    input: MarketplaceShipmentCreateInputDto,
    cycleOrders: MarketplaceOrderDomainEntity[]
  ): Promise<Array<{ group: MarketplaceShipmentGroupInput; orders: MarketplaceOrderDomainEntity[] }>> {
    const cycleKUs = new Set(cycleOrders.map((o) => o.delivery_braname));
    const resolved: Array<{ group: MarketplaceShipmentGroupInput; orders: MarketplaceOrderDomainEntity[] }> = [];

    for (const group of input.groups) {
      if (!cycleKUs.has(group.braname)) {
        await this.rejectComposition(
          input,
          MarketplaceSupplyValidationReasons.UNKNOWN_ORDER,
          `КУ "${group.braname}" не присутствует ни в одном Order'е заявки.`
        );
      }

      const kuAcceptedOrders = cycleOrders.filter(
        (o) => o.delivery_braname === group.braname && o.status === 'ACCEPTED'
      );

      let orders: MarketplaceOrderDomainEntity[];
      if (group.order_ids && group.order_ids.length > 0) {
        const idSet = new Set(group.order_ids);
        orders = kuAcceptedOrders.filter((o) => idSet.has(o.id));
        // Каждый запрошенный id обязан резолвиться в ACCEPTED-заказ этого КУ.
        if (orders.length !== idSet.size) {
          await this.rejectComposition(
            input,
            MarketplaceSupplyValidationReasons.ORDER_SET_MISMATCH,
            `Часть выбранных заказов недоступна для формирования по КУ "${group.braname}" ` +
              `(не принадлежит КУ, не в статусе ACCEPTED или уже включена в другую партию).`
          );
        }
      } else {
        orders = kuAcceptedOrders;
      }

      if (orders.length === 0) {
        await this.rejectComposition(
          input,
          MarketplaceSupplyValidationReasons.ORDER_SET_MISMATCH,
          `Для КУ "${group.braname}" нет акцептованных заказов для формирования партии.`
        );
      }

      resolved.push({ group, orders });
    }

    return resolved;
  }

  /** Записать отказ валидации состава и кинуть BadRequest (never-возврат). */
  private async rejectComposition(
    input: MarketplaceShipmentCreateInputDto,
    reason_code: MarketplaceSupplyValidationReason,
    message: string
  ): Promise<never> {
    await this.logRejection(input, reason_code, message);
    throw new BadRequestException(`Состав поставки не соответствует акцептованной заявке: ${message}`);
  }

  // ⚠️ ЗАРЕЗЕРВИРОВАНО / ПОКА НЕ ВЫЗЫВАЕТСЯ. Фабричная генерация ТТН (registry
  // 1103) отключена: пользовательская ТТН рендерится на фронте на лету, в реестр
  // с ЭЦП не публикуется (см. комментарий в основном цикле выше). Метод оставлен
  // на случай, когда ТТН понадобится подписывать/хранить в общем реестре.
  private async generateAndStoreTtnDocument(input: {
    coopname: string;
    shipment_id: string;
    cycle_id: string;
    braname: string;
    supplier_account: string;
    total_amount: string;
    ttn_number: string;
    ttn_data: MarketplaceShipmentTTNData;
  }): Promise<string> {
    // Поля ttn_data опциональны (паспорт убран, остальное — что известно).
    // Этот фабричный путь сейчас НЕ вызывается (единый источник ТТН — фронт);
    // пустые коэрцим в '' лишь для сохранения контракта PrivateData.
    const privatePayload: Cooperative.Registry.MarketplaceTransportNote.PrivateData = {
      expeditor_full_name: input.ttn_data.expeditor_full_name ?? '',
      expeditor_phone: input.ttn_data.expeditor_phone ?? '',
      vehicle_number: input.ttn_data.vehicle_number ?? '',
      loading_address: input.ttn_data.loading_address ?? '',
      loading_datetime: input.ttn_data.loading_datetime ?? '',
      delivery_datetime_estimate: input.ttn_data.delivery_datetime_estimate ?? '',
    };

    const { hash: doc_data_hash } = await this.documentPort.saveData(
      privatePayload as unknown as Record<string, unknown>,
      Cooperative.Registry.MarketplaceTransportNote.registry_id
    );

    const action: Cooperative.Registry.MarketplaceTransportNote.Action = {
      registry_id: Cooperative.Registry.MarketplaceTransportNote.registry_id,
      coopname: input.coopname,
      username: input.supplier_account,
      ttn_number: input.ttn_number,
      cycle_id: input.cycle_id,
      shipment_id: input.shipment_id,
      accept_braname: input.braname,
      supplier_account: input.supplier_account,
      total_amount: input.total_amount,
      currency: this.assetConfig.symbol,
      doc_data_hash,
      skip_save: true,
    };

    const document = await this.documentPort.generate({ data: action });

    const stored = await this.ttnRepo.create({
      coopname: input.coopname,
      shipment_id: input.shipment_id,
      ttn_number: input.ttn_number,
      registry_id: Cooperative.Registry.MarketplaceTransportNote.registry_id,
      document_hash: document.hash,
      content_html: document.html,
      meta: document.meta as Record<string, unknown>,
      supplier_account: input.supplier_account,
      accept_braname: input.braname,
      total_amount: input.total_amount,
      currency: this.assetConfig.symbol,
      ttn_data: input.ttn_data,
    });
    return stored.id;
  }

  // Номер ТТН — человекочитаемый русский: «ТТН-<12 hex>». Без латинского
  // braname/cycle и многосекционных дефисов (они в У ничего не значат). 6 байт
  // случайности (2^48) — коллизия практически невозможна; уникальность одна на
  // партию. Один и тот же номер печатается и в фабричном документе, и в превью.
  private computeTTNNumber(): string {
    return `ТТН-${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  private sumAmount(orders: MarketplaceOrderDomainEntity[]): string {
    const total = orders.reduce((acc, o) => acc + Number.parseFloat(o.total_cost), 0);
    return total.toFixed(4);
  }

  private async logRejection(
    input: MarketplaceShipmentCreateInputDto,
    reason_code: MarketplaceSupplyValidationReason,
    message: string
  ): Promise<void> {
    try {
      await this.logRepo.create({
        coopname: input.coopname,
        cycle_id: input.cycle_id,
        offerer_account: input.offerer_account,
        outcome: MarketplaceSupplyValidationOutcomes.REJECTED,
        reason: message,
        reason_code,
        attempted_groups: input.groups,
      });
    } catch (err: any) {
      // Лог нельзя сделать показательным — write-only, не блокируем основной flow.
      this.logger.warn(
        `MarketplaceShipmentCreateService.logRejection: запись отказа упала (${err.message}); основной flow продолжается.`
      );
    }
  }
}

export const MARKETPLACE_SHIPMENT_CREATE_SERVICE = Symbol('MARKETPLACE_SHIPMENT_CREATE_SERVICE');
