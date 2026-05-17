import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Cooperative } from 'cooptypes';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
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

/** Группа доставки одного поставщика на один КУ. */
export interface MarketplaceShipmentGroupInput {
  braname: string;
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
 *   4. Для Варианта Б генерирует уникальный ttn_number (Story 5.1 form);
 *      реальный PDF-документ через document-factory подключается follow-up'ом
 *      (Story 5.1 техдолг — AR33 интеграция).
 *
 * Документ ТТН рендерится через платформенный document-factory под
 * registry_id=1103 (`Cooperative.Registry.MarketplaceTransportNote`),
 * сохраняется в локальном реестре `marketplace_ttn_document` и не
 * публикуется в общий реестр документов кооператива — экспедиторы
 * пока не пайщики и подписывают перевозку вне платформы. Ссылка на
 * документ кладётся в `Shipment.ttn_document_id`.
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
    private readonly documentDomainService: DocumentDomainService,
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
      const groupOrders = validation.groupOrders.get(group.braname) ?? [];
      const groupAmount = this.sumAmount(groupOrders);
      const ttnNumber =
        group.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR
          ? this.computeTTNNumber(cycle.coopname, cycle.id, group.braname)
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

      // Вариант Б: рендерим ТТН через document-factory (registry_id=1103) и
      // сохраняем в локальном marketplace-реестре; в общий реестр документов
      // кооператива ТТН не публикуется.
      if (
        group.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR &&
        ttnNumber &&
        group.ttn_data
      ) {
        const ttnDocId = await this.generateAndStoreTtnDocument({
          coopname: cycle.coopname,
          shipment_id: shipment.id,
          cycle_id: cycle.id,
          braname: group.braname,
          supplier_account: cycle.supplier_account,
          total_amount: groupAmount,
          ttn_number: ttnNumber,
          ttn_data: group.ttn_data,
        });
        await this.shipmentRepo.applyTtnDocumentId(shipment.id, ttnDocId);
        shipment.ttn_document_id = ttnDocId;
      }

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
    const groupKUs = new Set(groups.map((g) => g.braname));

    // Каждая группа должна указывать braname, который реально есть в заявке.
    for (const g of groups) {
      if (!cycleKUs.has(g.braname)) {
        return {
          ok: false,
          reason_code: MarketplaceSupplyValidationReasons.UNKNOWN_ORDER,
          message: `КУ "${g.braname}" не присутствует ни в одном Order'е заявки.`,
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

    // Группы между собой не должны пересекаться по braname.
    if (groupKUs.size !== groups.length) {
      return {
        ok: false,
        reason_code: MarketplaceSupplyValidationReasons.KU_GROUPS_OVERLAP,
        message: 'Группы доставки пересекаются по КУ (повтор braname).',
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
    const privatePayload: Cooperative.Registry.MarketplaceTransportNote.PrivateData = {
      expeditor_full_name: input.ttn_data.expeditor_full_name,
      expeditor_phone: input.ttn_data.expeditor_phone,
      expeditor_id_doc: input.ttn_data.expeditor_id_doc,
      vehicle_number: input.ttn_data.vehicle_number,
      loading_address: input.ttn_data.loading_address,
      loading_datetime: input.ttn_data.loading_datetime,
      delivery_datetime_estimate: input.ttn_data.delivery_datetime_estimate,
    };

    const { hash: doc_data_hash } = await this.documentDomainService.saveDocData(
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

    const document = await this.documentDomainService.generateDocument({ data: action });

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

  private computeTTNNumber(coopname: string, cycle_id: string, braname: string): string {
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const cycleShort = cycle_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const kuShort = braname.slice(0, 6).toUpperCase();
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
