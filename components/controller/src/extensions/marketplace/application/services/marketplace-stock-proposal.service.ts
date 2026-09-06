import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort, type InnerGeneratedDocument } from '@coopenomics/innercoop';
import type { MarketplaceShareReturnStatementSignedInputDTO } from '../documents-dto/marketplace-share-return-statement-document.dto';
import type { MarketplaceConvertStatementSignedInputDTO } from '../documents-dto/marketplace-convert-statement-document.dto';
import { MARKETPLACE_CONVERT_SERVICE, MarketplaceConvertService } from './marketplace-convert.service';
import { computeStockOrderHash } from '../shared/order-hash.util';
import type { MarketplaceIssuanceSagaDomainEntity } from '../../domain/entities/marketplace-issuance-saga.entity';
import { MarketplaceIssuanceSagaStages } from '../../domain/entities/marketplace-issuance-saga.types';
import {
  MARKETPLACE_ISSUANCE_SAGA_REPOSITORY,
  type MarketplaceIssuanceSagaDomainRepository,
} from '../../domain/repositories/marketplace-issuance-saga.repository';
import { resolveSaleUnit, type ResolvedSaleUnit } from '../shared/packaging.util';
import {
  MARKETPLACE_ISSUANCE_SERVICE,
  type MarketplaceIssuanceService,
} from './marketplace-issuance.service';
import {
  MARKETPLACE_ECONOMY_SERVICE,
  MarketplaceEconomyService,
} from './marketplace-economy.service';
import {
  MARKETPLACE_STOCK_PROPOSAL_REPOSITORY,
  type MarketplaceStockProposalDomainRepository,
} from '../../domain/repositories/marketplace-stock-proposal.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import { MarketplaceStockService, MARKETPLACE_STOCK_SERVICE } from './marketplace-stock.service';
import { MarketplaceOfferStatuses } from '../../domain/entities/marketplace-offer.types';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import { assertValidQuantity } from '../shared/quantity.util';
import {
  MarketplaceStockProposalStatuses,
  type MarketplaceStockProposalItem,
  type MarketplaceStockProposalStatus,
} from '../../domain/entities/marketplace-stock-proposal.types';
import type { MarketplaceStockProposalDomainEntity } from '../../domain/entities/marketplace-stock-proposal.entity';
import {
  MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT,
  MARKETPLACE_STOCK_PROPOSAL_RESOLVED_EVENT,
  type MarketplaceStockProposalCreatedEvent,
  type MarketplaceStockProposalResolvedEvent,
} from '../events/marketplace-notification.events';

/** Строка корзины докладки на этапе формирования бандла оператором. */
export interface MarketplaceStockProposalCreateLine {
  offer_id: string;
  quantity: number;
  /** Выбранная упаковка каталога (та же, что и в подготовке payloads); null — отпуск по мере. */
  package_id?: string | null;
  /** Детерминированный order_hash (из payloads оператора). */
  order_hash: string;
}

/**
 * Строка обычного заказа в бандле: заказ уже существует (принят кооперативом),
 * оператор сверил факт (кол-во/цену). Подписи оператора нет — подпись
 * закрывающая, после подписи акта пайщиком.
 */
export interface MarketplaceOrderProposalCreateLine {
  order_id: string;
  /** Фактическое количество к выдаче в базовой единице (оператор сверил у стойки). */
  actual_quantity: number;
  /** Фактическая цена за единицу отпуска (оператор мог скорректировать). */
  actual_unit_price: string;
}

export interface MarketplaceStockProposalCreateInput {
  coopname: string;
  operator_account: string;
  braname: string;
  member_account: string;
  /** Строки докладки со склада (заказ родится на подписи пайщика). */
  items: MarketplaceStockProposalCreateLine[];
  /** Строки уже существующих обычных заказов пайщика к выдаче. */
  order_items?: MarketplaceOrderProposalCreateLine[];
}

export interface MarketplaceStockProposalAcceptResult {
  proposal: MarketplaceStockProposalDomainEntity;
  order_ids: string[];
  /** Ход выдачи по каждому заказу бандла — с актуальным этапом после решения совета. */
  sagas: MarketplaceIssuanceSagaDomainEntity[];
}

/** Строка докладки к формированию бандла: детерминированный order_hash + снапшоты. */
export interface MarketplaceStockIssuanceOperatorLine {
  offer_id: string;
  quantity: number;
  order_hash: string;
  unit_price: string;
  product_name: string;
  package_id: string | null;
  package_size: number;
}

/**
 * Строка к подписи пайщиком: заявление о возврате паевого взноса имуществом
 * по заказу или докладке и заявление 1110 о переводе паевого взноса на оплату
 * с уплатой членского взноса: по докладке — всегда (полная сумма заказа из
 * остатка с выделением взноса участка), по существующему заказу — только на
 * доплату при факте больше заказа, когда членского кошелька не хватает на
 * довзнос; иначе `convert_statement` пустой.
 */
export interface MarketplaceStockAcceptOrderLine {
  offer_id: string;
  order_id: string | null;
  order_hash: string;
  statement: InnerGeneratedDocument;
  convert_amount: string;
  convert_statement: InnerGeneratedDocument | null;
}

/** Полезная нагрузка к одной подписи пайщика: заявления по строкам. */
export interface MarketplaceStockAcceptPayload {
  order_lines: MarketplaceStockAcceptOrderLine[];
}

/** Строка подписания: order_hash, подписанное заказчиком заявление 1113 и, если было выдано, 1110. */
export interface MarketplaceStockFinalizeLine {
  order_hash: string;
  signed_statement: MarketplaceShareReturnStatementSignedInputDTO;
  signed_convert?: MarketplaceConvertStatementSignedInputDTO | null;
}

/** Строка бандла с планом сумм (порядок = порядок проведения). */
interface BundlePlannedItem {
  item: MarketplaceStockProposalItem;
  /** Тело: стоимость заказа из остатка (докладка) либо доплата по факту (существующий заказ), в единицах. */
  body_units: bigint;
  /** Взнос участка (докладка) либо довзнос по факту (существующий заказ), в единицах. */
  fee_units: bigint;
  /** Недостающая до взноса часть членского кошелька — переводится из паевого в членский. */
  convert_units: bigint;
}

export interface MarketplaceStockFinalizeInput {
  order_lines: MarketplaceStockFinalizeLine[];
}

/**
 * Бандл выдачи у стойки (паевая модель, компонент 68): оператор после
 * QR-резолва пайщика собирает в одно предложение его заказы к выдаче и/или
 * докладку из опубликованного остатка КУ, фиксируя факт по каждой строке →
 * пайщику немедленно уходит сигнал → пайщик одним нажатием подписывает
 * заявления о возврате паевого взноса имуществом по всем строкам → по каждой
 * строке: заказ из остатка (для докладки) → повестка совета → сага выдачи.
 * Неподписанный бандл ничего не резервирует; оператор может отозвать и
 * переформировать его.
 */
@Injectable()
export class MarketplaceStockProposalService {
  constructor(
    @Inject(MARKETPLACE_STOCK_PROPOSAL_REPOSITORY)
    private readonly proposalRepo: MarketplaceStockProposalDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_STOCK_SERVICE)
    private readonly stockService: MarketplaceStockService,
    @Inject(MARKETPLACE_ISSUANCE_SERVICE)
    private readonly issuanceService: MarketplaceIssuanceService,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    @Inject(MARKETPLACE_CONVERT_SERVICE)
    private readonly convertService: MarketplaceConvertService,
    @Inject(MARKETPLACE_ISSUANCE_SAGA_REPOSITORY)
    private readonly sagaRepo: MarketplaceIssuanceSagaDomainRepository,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceStockProposalService.name);
  }

  /**
   * План членского взноса по бандлу в порядке проведения: сначала докладка
   * (заказы из остатка рождаются первыми и берут взнос участка с членского
   * кошелька программы), затем довзносы по существующим заказам при факте
   * больше заказа. Остаток членского кошелька зачитывается последовательно,
   * недостающее по каждой строке — конвертация по заявлению 1110. Порядок
   * обязан совпадать с `finalizeStockIssuance`, иначе суммы заявлений и
   * расчёт контракта разойдутся.
   */
  private async planBundle(
    coopname: string,
    proposal: MarketplaceStockProposalDomainEntity,
    member_account: string
  ): Promise<BundlePlannedItem[]> {
    const feePercent = await this.economyService.getMembershipFeeContractPercent(coopname);
    const stockItems = proposal.items.filter((i) => !i.order_id);
    const orderItems = proposal.items.filter((i) => !!i.order_id);
    const bodies: bigint[] = [];
    const fees: bigint[] = [];
    for (const item of stockItems) {
      const { resolved } = await this.validateStockLine(coopname, proposal.braname, item.offer_id, item.quantity, item.package_id);
      const saleUnitCount = resolved.packageSize > 0 ? resolved.packageCount! : resolved.baseQuantity;
      const body = this.economyService.lineBodyUnits(resolved.unitPrice, saleUnitCount);
      bodies.push(body);
      fees.push(this.economyService.membershipFeeUnits(body, feePercent));
    }
    const topUps: Array<{ body: bigint; fee: bigint }> = [];
    for (const item of orderItems) {
      const t = await this.issuanceService.getFeeTopUp(coopname, item.order_id!, member_account);
      topUps.push({ body: t.body_topup_units, fee: t.topup_units });
    }
    const memberAvailable = await this.convertService.memberAvailableUnits(coopname, member_account);
    const plan = this.convertService.planConversions(memberAvailable, [...fees, ...topUps.map((t) => t.fee)]);
    const planned: BundlePlannedItem[] = [];
    stockItems.forEach((item, i) => planned.push({ item, body_units: bodies[i]!, fee_units: fees[i]!, convert_units: plan[i]!.convert_units }));
    orderItems.forEach((item, i) =>
      planned.push({ item, body_units: topUps[i]!.body, fee_units: topUps[i]!.fee, convert_units: plan[fees.length + i]!.convert_units })
    );
    return planned;
  }

  /**
   * Заявления к одной подписи пайщика: по каждой строке бандла — заявление о
   * возврате паевого взноса имуществом (1113). Для существующих заказов
   * документ строится из саги (факт зафиксирован оператором), для докладки —
   * из строки бандла по детерминированному order_hash. По докладке к строке
   * всегда добавляется заявление 1110 о переводе паевого взноса на оплату с
   * уплатой членского взноса участка; по существующему заказу — только на
   * доплату при факте больше заказа, когда членского кошелька не хватает.
   */
  async getAcceptSignablePayloads(
    coopname: string,
    proposal_id: string,
    member_account: string
  ): Promise<MarketplaceStockAcceptPayload> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Подписать заявления может только адресат предложения.');
    }
    this.assertProposed(proposal);
    for (const item of proposal.items) {
      if (!item.order_hash) {
        throw new ConflictException('Бандл в устаревшем формате (без order_hash) — переформируйте его у стойки.');
      }
    }
    const feePercent = await this.economyService.getMembershipFeeContractPercent(coopname);
    const planned = await this.planBundle(coopname, proposal, member_account);
    const planByHash = new Map(planned.map((p) => [p.item.order_hash!, p]));
    const order_lines: MarketplaceStockAcceptOrderLine[] = [];
    for (const item of proposal.items) {
      const plan = planByHash.get(item.order_hash!)!;
      const needsStatement = !item.order_id || plan.convert_units > 0n;
      const convert_statement = needsStatement
        ? await this.convertService.generateStatement({
            coopname,
            username: member_account,
            order_hash: item.order_hash!,
            body_units: plan.body_units,
            fee_units: plan.fee_units,
            convert_units: plan.convert_units,
            fee_contract_percent: feePercent,
            source: 'market',
          })
        : null;
      const convert_amount = this.economyService.unitsToAsset(plan.convert_units);
      if (item.order_id) {
        const statement = await this.issuanceService.getStatementSignablePayload(coopname, item.order_id, member_account);
        order_lines.push({ offer_id: item.offer_id, order_id: item.order_id, order_hash: item.order_hash!, statement, convert_amount, convert_statement });
        continue;
      }
      const { offer, resolved } = await this.validateStockLine(coopname, proposal.braname, item.offer_id, item.quantity, item.package_id);
      const statement = await this.issuanceService.generateStatementPreview({
        coopname,
        orderer_account: member_account,
        order_hash: item.order_hash!,
        braname: proposal.braname,
        offer_id: offer.id,
        product_title: offer.product_name,
        unit_of_measure: offer.unit_of_measure,
        package_size: resolved.packageSize,
        actual_quantity: resolved.baseQuantity,
        actual_unit_price: resolved.unitPrice,
      });
      order_lines.push({ offer_id: item.offer_id, order_id: null, order_hash: item.order_hash!, statement, convert_amount, convert_statement });
    }
    return { order_lines };
  }

  /**
   * Валидация строки докладки: активный оффер остатка ИМЕННО этого КУ + кол-во.
   * Эпик 18: `quantity` — базовое количество при отпуске по мере, число упаковок
   * при отпуске упаковкой (тот же контракт, что и у обычного заказа — см.
   * `resolveSaleUnit`); остаток на складе всегда сверяется в базовых единицах.
   */
  private async validateStockLine(
    coopname: string,
    braname: string,
    offer_id: string,
    quantity: number,
    package_id: string | null | undefined
  ): Promise<{ offer: MarketplaceOfferDomainEntity; resolved: ResolvedSaleUnit }> {
    if (!(quantity > 0)) {
      throw new BadRequestException('Количество в строке должно быть больше нуля.');
    }
    const offer = await this.offerRepo.findById(offer_id);
    if (!offer || offer.coopname !== coopname) {
      throw new NotFoundException('Предложение остатка не найдено.');
    }
    if (offer.stock_braname !== braname) {
      throw new BadRequestException(
        `«${offer.product_name}» — остаток другого КУ, со стойки ${braname} не докладывается.`
      );
    }
    if (offer.status !== MarketplaceOfferStatuses.ACTIVE) {
      throw new BadRequestException(`«${offer.product_name}» снят с публикации.`);
    }
    const resolved = resolveSaleUnit(offer, quantity, package_id);
    if (offer.quantity_available < resolved.baseQuantity) {
      throw new BadRequestException(
        `«${offer.product_name}»: на складе свободно ${offer.quantity_available} ед., нельзя предложить ${resolved.baseQuantity}.`
      );
    }
    return { offer, resolved };
  }

  /**
   * Валидация строки обычного заказа в бандле + снапшот для показа пайщику.
   * Заказ обязан быть принят кооперативом (или уже готов к выдаче) без начатой
   * выдачи, принадлежать адресату бандла и выдаваться ИМЕННО с этого КУ.
   * order_hash берётся из заказа, product_name — из оффера заказа.
   */
  private async buildOrderItem(
    coopname: string,
    braname: string,
    member_account: string,
    line: MarketplaceOrderProposalCreateLine
  ): Promise<MarketplaceStockProposalItem> {
    if (!(line.actual_quantity > 0)) {
      throw new BadRequestException('Количество в строке заказа должно быть больше нуля.');
    }
    if (Number.parseFloat(line.actual_unit_price) <= 0) {
      throw new BadRequestException('Цена в строке заказа должна быть больше нуля.');
    }
    const order = await this.orderRepo.findById(line.order_id);
    if (!order || order.coopname !== coopname) {
      throw new NotFoundException(`Заказ ${line.order_id} не найден.`);
    }
    if (order.orderer_account !== member_account) {
      throw new BadRequestException('Заказ принадлежит другому пайщику — нельзя включить его в бандл этого получателя.');
    }
    if (order.delivery_braname !== braname) {
      throw new BadRequestException(`Заказ выдаётся на другом КУ (${order.delivery_braname}), со стойки ${braname} не выдаётся.`);
    }
    if (order.status !== 'ACCEPTED_TO_COOP' && order.status !== 'READY_TO_RECEIVE') {
      throw new ConflictException(`Заказ ${order.id} (статус «${order.status}») не готов к выдаче.`);
    }
    const active = await this.sagaRepo.findActiveByOrderId(coopname, order.id);
    if (active && active.stage !== MarketplaceIssuanceSagaStages.FACT_FIXED) {
      throw new ConflictException(`По заказу ${order.id} выдача уже начата (этап «${active.stage}»).`);
    }
    assertValidQuantity(line.actual_quantity, order.unit_of_measure);
    const offer = await this.offerRepo.findById(order.offer_id);
    return {
      order_id: order.id,
      offer_id: order.offer_id,
      quantity: line.actual_quantity,
      unit_price: line.actual_unit_price,
      product_name: offer?.product_name ?? 'Товар по предложению',
      unit_of_measure: offer?.unit_of_measure ?? null,
      package_size: order.package_size,
      order_hash: order.order_hash,
    };
  }

  /**
   * Строки докладки к формированию бандла: детерминированный order_hash (он
   * же уйдёт в будущий stockorder) и снапшоты для корзины. Документов оператор
   * не подписывает — его подпись закрывающая, после подписи акта пайщиком.
   */
  async getOperatorIssuancePayloads(input: {
    coopname: string;
    braname: string;
    member_account: string;
    operator_account: string;
    items: Array<{ offer_id: string; quantity: number; package_id?: string | null }>;
  }): Promise<MarketplaceStockIssuanceOperatorLine[]> {
    if (input.items.length === 0) {
      throw new BadRequestException('Корзина докладки пуста — добавьте позиции из остатка.');
    }
    const lines: MarketplaceStockIssuanceOperatorLine[] = [];
    for (const item of input.items) {
      const { offer, resolved } = await this.validateStockLine(input.coopname, input.braname, item.offer_id, item.quantity, item.package_id);
      lines.push({
        offer_id: offer.id,
        quantity: item.quantity,
        order_hash: computeStockOrderHash(input.coopname, input.member_account, offer.id),
        unit_price: resolved.unitPrice,
        product_name: offer.product_name,
        package_id: resolved.packageId,
        package_size: resolved.packageSize,
      });
    }
    return lines;
  }

  /**
   * Оператор формирует бандл. Для существующих заказов сразу отмечается
   * готовность к выдаче (если ещё не отмечена) и фиксируется факт — рождаются
   * саги в FACT_FIXED, пайщику уходит сигнал «подпишите заявления».
   */
  async createProposal(input: MarketplaceStockProposalCreateInput): Promise<MarketplaceStockProposalDomainEntity> {
    const orderLines = input.order_items ?? [];
    if (input.items.length === 0 && orderLines.length === 0) {
      throw new BadRequestException('Бандл пуст — добавьте позиции заказа или докладку со склада.');
    }
    const items: MarketplaceStockProposalItem[] = [];
    for (const line of input.items) {
      const { offer, resolved } = await this.validateStockLine(input.coopname, input.braname, line.offer_id, line.quantity, line.package_id);
      if (!line.order_hash) {
        throw new BadRequestException('Строка без order_hash — переформируйте докладку.');
      }
      items.push({
        offer_id: offer.id,
        quantity: line.quantity,
        unit_price: resolved.unitPrice,
        product_name: offer.product_name,
        unit_of_measure: offer.unit_of_measure,
        package_id: resolved.packageId,
        package_size: resolved.packageSize,
        order_hash: line.order_hash,
      });
    }
    for (const line of orderLines) {
      items.push(await this.buildOrderItem(input.coopname, input.braname, input.member_account, line));
    }
    const proposal = await this.proposalRepo.create({
      coopname: input.coopname,
      braname: input.braname,
      member_account: input.member_account,
      operator_account: input.operator_account,
      items,
    });
    // Существующие заказы: готовность (без подписи) и факт у стойки — сага рождается сейчас.
    for (const line of orderLines) {
      const order = await this.orderRepo.findById(line.order_id);
      if (order && order.status === 'ACCEPTED_TO_COOP') {
        await this.issuanceService.readyIssue({ coopname: input.coopname, order_id: line.order_id, operator_account: input.operator_account });
      }
      await this.issuanceService.fixFact({
        coopname: input.coopname,
        operator_account: input.operator_account,
        order_id: line.order_id,
        proposal_id: proposal.id,
        actual_quantity: line.actual_quantity,
        actual_unit_price: line.actual_unit_price,
      });
    }
    const event: MarketplaceStockProposalCreatedEvent = {
      coopname: proposal.coopname,
      proposal_id: proposal.id,
      member_account: proposal.member_account,
      braname: proposal.braname,
    };
    this.eventBus.emit(MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT, event);
    this.logger.log(`Бандл выдачи ${proposal.id} пайщику ${proposal.member_account} (${items.length} строк, КУ ${proposal.braname}, оператор ${input.operator_account}).`);
    return proposal;
  }

  /**
   * Пайщик ОДНИМ нажатием подписал заявления по всем строкам. По каждой:
   * докладка → заказ из остатка (stockorder, паевой резерв из свободного
   * паевого) → готовность → факт → заявление в цепь и повестка совета; обычный
   * заказ → заявление в цепь и повестка совета. Робот решений совета зовётся
   * напрямую и ждётся у стойки; ответ несёт саги на актуальном этапе.
   *
   * Фаза создания заказов из остатка атомарна: на фейле созданные заказы
   * отменяются. Заявления идут после: сбой одной строки не откатывает
   * остальные — они уже на повестке совета, сага каждой живёт сама.
   */
  async finalizeStockIssuance(
    coopname: string,
    proposal_id: string,
    member_account: string,
    input: MarketplaceStockFinalizeInput
  ): Promise<MarketplaceStockProposalAcceptResult> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Подписать заявления может только адресат предложения.');
    }
    this.assertProposed(proposal);
    const signedByHash = new Map((input.order_lines ?? []).map((l) => [l.order_hash, l]));
    for (const item of proposal.items) {
      if (!item.order_hash) throw new ConflictException('Бандл в устаревшем формате — переформируйте его у стойки.');
      if (!signedByHash.get(item.order_hash)?.signed_statement) {
        throw new BadRequestException('Состав подписания не совпадает с бандлом — обновите подписание.');
      }
    }
    // План по свежему балансу членского кошелька: суммы конвертации обязаны
    // совпасть с подписанными заявлениями 1110, иначе подписание повторяется.
    const planned = await this.planBundle(coopname, proposal, member_account);
    const planByHash = new Map(planned.map((p) => [p.item.order_hash!, p]));

    // ── 1) Заказы из остатка — атомарно ────────────────────────────────
    const issuables: Array<{ order_id: string; item: MarketplaceStockProposalItem; fresh: boolean }> = [];
    const createdStock: string[] = [];
    try {
      for (const item of proposal.items) {
        if (item.order_id) {
          issuables.push({ order_id: item.order_id, item, fresh: false });
          continue;
        }
        const plan = planByHash.get(item.order_hash!)!;
        const convert_statement = this.convertService.verifySigned(
          signedByHash.get(item.order_hash!)?.signed_convert,
          { order_hash: item.order_hash!, body_units: plan.body_units, fee_units: plan.fee_units, convert_units: plan.convert_units },
          member_account
        );
        const { order } = await this.stockService.createStockOrder({
          coopname,
          orderer_account: member_account,
          offer_id: item.offer_id,
          quantity: item.quantity,
          package_id: item.package_id ?? null,
          checkout_id: proposal.id,
          order_hash: item.order_hash!,
          convert_statement,
        });
        createdStock.push(order.id);
        issuables.push({ order_id: order.id, item, fresh: true });
      }
    } catch (error) {
      for (const order_id of createdStock) {
        try {
          await this.stockService.cancelStockOrder(coopname, order_id, member_account, 'Подписание бандла не завершилось — строка отменена');
        } catch (compErr: any) {
          this.logger.error(`finalizeStockIssuance: компенсирующая отмена stock-order ${order_id} упала: ${compErr.message}. РУЧНАЯ СВЕРКА!`);
        }
      }
      throw error;
    }

    // ── 2) Заявления в цепь: по каждому заказу — сага ──────────────────
    const order_ids: string[] = [];
    const sagas: MarketplaceIssuanceSagaDomainEntity[] = [];
    for (const { order_id, item, fresh } of issuables) {
      if (fresh) {
        const order = await this.orderRepo.findById(order_id);
        await this.issuanceService.readyIssue({ coopname, order_id, operator_account: proposal.operator_account });
        await this.issuanceService.fixFact({
          coopname,
          operator_account: proposal.operator_account,
          order_id,
          proposal_id: proposal.id,
          // Факт докладки: базовое количество созданного заказа и цена публикации.
          actual_quantity: order?.quantity ?? item.quantity,
          actual_unit_price: item.unit_price,
        });
      }
      const signedLine = signedByHash.get(item.order_hash!)!;
      const saga = await this.issuanceService.submitStatement({
        coopname,
        member_account,
        order_id,
        signed_statement: signedLine.signed_statement,
        // Довзнос по факту существующего заказа: заявление 1110 сверяется в саге
        // по свежему балансу (заказы из остатка выше уже забрали своё).
        signed_convert: fresh ? null : signedLine.signed_convert ?? null,
      });
      sagas.push(saga);
      order_ids.push(order_id);
    }

    const resolved = await this.proposalRepo.applyResolution(
      proposal.id,
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.ACCEPTED,
      order_ids
    );
    if (!resolved) {
      this.logger.warn(`finalizeStockIssuance: бандл ${proposal.id} отозван в гонке, но заявления уже поданы (${order_ids.join(',')}).`);
      const stale = await this.loadProposal(coopname, proposal_id);
      this.emitResolved(stale);
      return { proposal: stale, order_ids, sagas };
    }
    this.emitResolved(resolved);
    this.logger.log(`Бандл ${proposal.id} подписан пайщиком ${member_account}: заявлений подано — ${order_ids.length}.`);
    return { proposal: resolved, order_ids, sagas };
  }

  /** Пайщик отказывается от предложения: саги в FACT_FIXED по заказам бандла снимаются. */
  async declineProposal(coopname: string, proposal_id: string, member_account: string): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Отказаться от предложения может только его адресат.');
    }
    this.assertProposed(proposal);
    const resolved = await this.proposalRepo.applyResolution(proposal.id, MarketplaceStockProposalStatuses.PROPOSED, MarketplaceStockProposalStatuses.DECLINED);
    if (!resolved) throw new ConflictException('Предложение уже разрешено.');
    await this.cancelFactFixedSagas(proposal);
    this.emitResolved(resolved);
    return resolved;
  }

  /** Оператор отзывает предложение (переформирование «а ещё сметаны положите»). */
  async cancelProposal(coopname: string, proposal_id: string, operator_account: string): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    this.assertProposed(proposal);
    const resolved = await this.proposalRepo.applyResolution(proposal.id, MarketplaceStockProposalStatuses.PROPOSED, MarketplaceStockProposalStatuses.CANCELLED);
    if (!resolved) throw new ConflictException('Предложение уже разрешено.');
    await this.cancelFactFixedSagas(proposal);
    this.emitResolved(resolved);
    this.logger.log(`Бандл ${proposal.id} отозван оператором ${operator_account}.`);
    return resolved;
  }

  async listProposals(filter: {
    coopname: string;
    member_account?: string;
    braname?: string | string[];
    status?: MarketplaceStockProposalStatus[];
  }): Promise<MarketplaceStockProposalDomainEntity[]> {
    return this.proposalRepo.list(filter);
  }

  // ── private ──────────────────────────────────────────────────────────

  /** Саги, не дошедшие до заявления, снимаются вместе с бандлом — без цепи. */
  private async cancelFactFixedSagas(proposal: MarketplaceStockProposalDomainEntity): Promise<void> {
    for (const item of proposal.items) {
      if (!item.order_id) continue;
      const saga = await this.sagaRepo.findActiveByOrderId(proposal.coopname, item.order_id);
      if (saga && saga.stage === MarketplaceIssuanceSagaStages.FACT_FIXED) {
        await this.issuanceService.cancelIssuance({ coopname: proposal.coopname, order_id: item.order_id, operator_account: proposal.operator_account });
      }
    }
  }

  private async loadProposal(coopname: string, proposal_id: string): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.proposalRepo.findById(proposal_id);
    if (!proposal || proposal.coopname !== coopname) {
      throw new NotFoundException('Предложение докладки не найдено.');
    }
    return proposal;
  }

  private assertProposed(proposal: MarketplaceStockProposalDomainEntity): void {
    if (proposal.status !== MarketplaceStockProposalStatuses.PROPOSED) {
      throw new ConflictException(`Предложение уже разрешено (статус «${proposal.status}»).`);
    }
  }

  private emitResolved(proposal: MarketplaceStockProposalDomainEntity): void {
    const event: MarketplaceStockProposalResolvedEvent = {
      coopname: proposal.coopname,
      proposal_id: proposal.id,
      member_account: proposal.member_account,
      braname: proposal.braname,
      resolution: proposal.status,
    };
    this.eventBus.emit(MARKETPLACE_STOCK_PROPOSAL_RESOLVED_EVENT, event);
  }
}

export const MARKETPLACE_STOCK_PROPOSAL_SERVICE = Symbol('MARKETPLACE_STOCK_PROPOSAL_SERVICE');
