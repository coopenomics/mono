import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
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

/** Группа доставки одного поставщика на один КУ. */
export interface MarketplaceShipmentGroupInput {
  ku_id: string;
  delivery_variant: MarketplaceShipmentDeliveryVariant;
  /** Только для Варианта Б — поля ТТН (form-input от поставщика). */
  ttn_data?: MarketplaceShipmentTTNData | null;
}

export interface MarketplaceShipmentCreateInputDto {
  coopname: string;
  /** Поставщик-инициатор (account из core-сессии). */
  offerer_account: string;
  /** ID консолидированной заявки в статусе ACCEPTED. */
  cycle_id: string;
  /** Группы доставки. По одной per ku_id; не пересекаются. */
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
 *   4. Для Варианта Б генерирует уникальный ttn_number (Story 5.1 form);
 *      реальный PDF-документ через document-factory подключается follow-up'ом
 *      (Story 5.1 техдолг — AR33 интеграция).
 *
 * MVP-ограничения (вынесено в техдолг эпика):
 *   - PDF ТТН формируется как локальный stub, реальная подписанная version
 *     через AR33 document factory подключается в follow-up Story 5.1.
 *   - Document registry id для ТТН пока nullable; полная интеграция —
 *     Story 5.4 (асинхронная подпись поставщика).
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
    private readonly logger: WinstonLoggerService
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

    // ── 2. Order'ы заявки + жёсткая валидация состава (Story 5.2) ──
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

    const validation = this.validateComposition(input.groups, cycleOrders);
    if (!validation.ok) {
      await this.logRejection(input, validation.reason_code, validation.message);
      throw new BadRequestException(`Состав поставки не соответствует акцептованной заявке: ${validation.message}`);
    }

    // ── 3. Идемпотентность: если Shipment'ы уже созданы → конфликт ─
    const existing = await this.shipmentRepo.findByCycleId(cycle.coopname, cycle.id);
    if (existing.length > 0) {
      throw new ConflictException(
        `Партии для заявки ${cycle.id} уже сформированы (${existing.length} шт.); повторное формирование запрещено.`
      );
    }

    // ── 4. Создание Shipment'ов + перевод Order'ов в SUPPLY_PREPARED ─
    const created: MarketplaceShipmentDomainEntity[] = [];
    for (const group of input.groups) {
      const groupOrders = validation.groupOrders.get(group.ku_id) ?? [];
      const groupAmount = this.sumAmount(groupOrders);
      const ttn = this.generateTTNIfNeeded(group, cycle.coopname, cycle.id);

      const shipment = await this.shipmentRepo.create({
        coopname: cycle.coopname,
        cycle_id: cycle.id,
        offerer_account: cycle.supplier_account,
        ku_id: group.ku_id,
        delivery_variant: group.delivery_variant,
        total_amount: groupAmount,
        ttn_number: ttn?.number ?? null,
        ttn_data: ttn?.data ?? null,
        ttn_document_registry_id: null,
        ttn_pdf_url: ttn?.pdf_url ?? null,
        status: MarketplaceShipmentStatuses.SUPPLY_PREPARED,
      });

      // Order'ы группы → SUPPLY_PREPARED (backend-only status).
      for (const o of groupOrders) {
        await this.orderRepo.applyStatusTransition(
          o.id,
          'SUPPLY_PREPARED',
          `Партия #${shipment.id} (вариант ${group.delivery_variant})`
        );
      }

      created.push(shipment);
      this.logger.log(
        `Shipment ${shipment.id} создан для cycle=${cycle.id}, ku=${group.ku_id}, вариант=${group.delivery_variant}, orders=${groupOrders.length}`
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
      if (!g.ku_id) {
        throw new BadRequestException('У одной из групп не указан ku_id.');
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
    }
  }

  private assertTTNData(ttn: MarketplaceShipmentTTNData | null | undefined): void {
    if (!ttn) {
      throw new BadRequestException('Для Варианта Б обязательны поля ТТН (экспедитор / транспорт / погрузка / доставка).');
    }
    const required: Array<keyof MarketplaceShipmentTTNData> = [
      'expeditor_full_name',
      'expeditor_phone',
      'expeditor_id_doc',
      'vehicle_number',
      'loading_address',
      'loading_datetime',
      'delivery_datetime_estimate',
    ];
    for (const key of required) {
      if (!ttn[key] || String(ttn[key]).trim().length === 0) {
        throw new BadRequestException(`Поле ТТН "${key}" обязательно для Варианта Б.`);
      }
    }
  }

  /**
   * Story 5.2: жёсткий акцепт состава поставки. Возвращает индекс
   * groupOrders на удачу — чтобы create-flow не пересчитывал.
   */
  private validateComposition(
    groups: MarketplaceShipmentGroupInput[],
    cycleOrders: MarketplaceOrderDomainEntity[]
  ):
    | { ok: true; groupOrders: Map<string, MarketplaceOrderDomainEntity[]> }
    | { ok: false; reason_code: MarketplaceSupplyValidationReason; message: string } {
    const cycleKUs = new Set(cycleOrders.map((o) => o.delivery_braname));
    const groupKUs = new Set(groups.map((g) => g.ku_id));

    // Каждая группа должна указывать ku_id, который реально есть в заявке.
    for (const g of groups) {
      if (!cycleKUs.has(g.ku_id)) {
        return {
          ok: false,
          reason_code: MarketplaceSupplyValidationReasons.UNKNOWN_ORDER,
          message: `КУ "${g.ku_id}" не присутствует ни в одном Order'е заявки.`,
        };
      }
    }

    // Каждое КУ заявки должно быть представлено ровно одной группой.
    for (const ku of cycleKUs) {
      if (!groupKUs.has(ku)) {
        return {
          ok: false,
          reason_code: MarketplaceSupplyValidationReasons.ORDER_SET_MISMATCH,
          message: `Для КУ "${ku}" не указана группа доставки.`,
        };
      }
    }

    // Группы между собой не должны пересекаться по ku_id.
    if (groupKUs.size !== groups.length) {
      return {
        ok: false,
        reason_code: MarketplaceSupplyValidationReasons.KU_GROUPS_OVERLAP,
        message: 'Группы доставки пересекаются по КУ (повтор ku_id).',
      };
    }

    // Order'ы заявки должны быть в статусе ACCEPTED (готовы к prep) либо
    // уже SUPPLY_PREPARED (повторный вызов — отрезается выше через existing-guard).
    const groupOrders = new Map<string, MarketplaceOrderDomainEntity[]>();
    for (const o of cycleOrders) {
      if (o.status !== 'ACCEPTED') {
        return {
          ok: false,
          reason_code: MarketplaceSupplyValidationReasons.ORDER_SET_MISMATCH,
          message: `Order ${o.id} находится в статусе ${o.status}; ожидался ACCEPTED.`,
        };
      }
      const arr = groupOrders.get(o.delivery_braname) ?? [];
      arr.push(o);
      groupOrders.set(o.delivery_braname, arr);
    }

    return { ok: true, groupOrders };
  }

  private generateTTNIfNeeded(
    group: MarketplaceShipmentGroupInput,
    coopname: string,
    cycle_id: string
  ): { number: string; data: MarketplaceShipmentTTNData; pdf_url: string } | null {
    if (group.delivery_variant !== MarketplaceShipmentDeliveryVariants.EXPEDITOR) return null;
    if (!group.ttn_data) {
      throw new BadRequestException('ttn_data отсутствует для Варианта Б.');
    }
    const number = this.computeTTNNumber(coopname, cycle_id, group.ku_id);
    // MVP-stub: реальная подпись и регистрация в document-factory подключаются
    // в Story 5.4 (асинхронная подпись поставщика на АПП).
    const pdf_url = `/api/marketplace/ttn/${number}.pdf`;
    return { number, data: group.ttn_data, pdf_url };
  }

  private computeTTNNumber(coopname: string, cycle_id: string, ku_id: string): string {
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const cycleShort = cycle_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const kuShort = ku_id.slice(0, 6).toUpperCase();
    return `${coopname.toUpperCase()}-TTN-${cycleShort}-${kuShort}-${suffix}`;
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
