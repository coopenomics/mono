import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cooperative, type MarketContract } from 'cooptypes';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import {
  DOCUMENT_VALIDATION_SERVICE,
  type DocumentValidationService,
} from '~/domain/document/services/document-validation.service';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import {
  USER_WALLET_REPOSITORY,
  type UserWalletRepository,
} from '~/domain/wallet/repositories/user-wallet.repository';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { MarketplaceConvertStatementSignedInputDTO } from '~/application/document/documents-dto/marketplace-convert-statement-document.dto';
import type { MarketplaceIssueActSignedDocumentInputDTO } from '~/application/document/documents-dto/marketplace-issue-act-document.dto';
import { computeStockOrderHash, computeConvertAnchorHash } from '../shared/order-hash.util';
import { marketplaceOrderUnitLabel } from '../shared/unit-label.util';
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
  /** АПП-выдачи, подписанный оператором первой подписью (signiss1). */
  signiss1_act: ISignedDocumentDomainInterface;
}

/**
 * Строка обычного заказа в бандле: заказ уже существует (ACCEPTED_TO_COOP),
 * оператор сверил факт (кол-во/цену) и подписал signiss1-акт. На финализации
 * заказ не создаётся — сразу выдача (openIssuance+signiss2).
 */
export interface MarketplaceOrderProposalCreateLine {
  order_id: string;
  /** Фактическое количество к выдаче (оператор сверил при открытии). */
  actual_quantity: number;
  /** Фактическая цена за единицу (оператор мог скорректировать). */
  actual_unit_price: string;
  /** АПП-выдачи, подписанный оператором первой подписью (signiss1). */
  signiss1_act: ISignedDocumentDomainInterface;
}

export interface MarketplaceStockProposalCreateInput {
  coopname: string;
  operator_account: string;
  braname: string;
  member_account: string;
  /** Строки докладки со склада (заказ родится на финализации). */
  items: MarketplaceStockProposalCreateLine[];
  /** Строки уже существующих обычных заказов пайщика к выдаче. */
  order_items?: MarketplaceOrderProposalCreateLine[];
}

export interface MarketplaceStockProposalAcceptResult {
  proposal: MarketplaceStockProposalDomainEntity;
  order_ids: string[];
}

/**
 * Нагрузка оператору для подписи signiss1 при формировании бандла: по строке —
 * детерминированный order_hash и сгенерированный АПП-выдачи (registry 1105),
 * который оператор подписывает своим ключом. Снапшоты — для показа в корзине.
 */
export interface MarketplaceStockIssuanceOperatorLine {
  offer_id: string;
  quantity: number;
  order_hash: string;
  unit_price: string;
  product_name: string;
  /** Выбранная упаковка каталога (Эпик 18); null — отпуск по мере. */
  package_id: string | null;
  /** Содержимое упаковки в базовой единице; 0 — отпуск по мере. */
  package_size: number;
  signiss1_document: DocumentDomainEntity;
}

/**
 * Строка к подписи пайщиком: offer + order_hash + АПП-выдачи, уже подписанный
 * оператором (агрегат: исходник по doc_hash + подписанный оператором документ),
 * который пайщик контрподписывает (signiss2).
 */
export interface MarketplaceStockAcceptOrderLine {
  offer_id: string;
  order_hash: string;
  signiss1_aggregate: DocumentDomainAggregate;
}

/**
 * Полезная нагрузка к подписи пайщиком (одна кнопка «Подписать»). Заявление о
 * конвертации — ОДНО на весь дефицит (не по каждой строке): `convert` != null
 * только когда членских средств не хватает; при замене из высвобожденных средств
 * `convert` == null — пайщику подписывать нечего, кроме самих актов.
 */
export interface MarketplaceStockAcceptPayload {
  /**
   * Сколько из стоимости докладки спишется с уже внесённых членских средств
   * «Стола заказов» (покрытие имеющимся; включая высвобожденные недосдачей).
   * Вместе с convert.amount даёт полную стоимость докладки.
   */
  member_amount: string;
  order_lines: MarketplaceStockAcceptOrderLine[];
  /**
   * Дефицит сверх членских — доплата с паевого через Заявление о конвертации.
   * null, если членских хватает (подписывать нечего).
   */
  convert: {
    amount: string;
    convert_hash: string;
    document: DocumentDomainEntity;
  } | null;
}

/** Строка финализации: order_hash + контрподписанный пайщиком АПП-выдачи (signiss2). */
export interface MarketplaceStockFinalizeLine {
  order_hash: string;
  signed_signiss2_act: MarketplaceIssueActSignedDocumentInputDTO;
}

/** Вход финализации: строки с подписью получения + единое Заявление (или нет). */
export interface MarketplaceStockFinalizeInput {
  order_lines: MarketplaceStockFinalizeLine[];
  signed_convert?: MarketplaceConvertStatementSignedInputDTO | null;
}

/**
 * requirement 76, решения 10–11: двухфазная докладка у стойки выдачи.
 *
 * Оператор после QR-резолва пайщика (заказ не обязателен — «просто зашёл»)
 * накидывает опубликованные позиции остатка своего КУ в предложение →
 * пайщику немедленно уходит websocket-сигнал → пайщик принимает → по каждой
 * строке создаётся заказ из остатка (stockorder: средства блокируются ИМЕННО
 * на акцепте; при нехватке паевых средств акцепт фейлится с человеческим
 * сообщением) → у стойки открывается выдача и акт уходит в гейт «подписи на
 * месте». До акцепта (и после акцепта — до своей подписи на акте, через
 * отмену заказов) оператор управляет судьбой докладки вручную: отозвать,
 * переформировать; автоаннулирования по таймауту нет.
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
    @Inject(USER_WALLET_REPOSITORY)
    private readonly userWalletRepo: UserWalletRepository,
    @Inject(DOCUMENT_VALIDATION_SERVICE)
    private readonly documentValidationService: DocumentValidationService,
    private readonly documentDomainService: DocumentDomainService,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceStockProposalService.name);
  }

  /**
   * Полезная нагрузка к ОДНОЙ подписи пайщика по докладке: по строке — её
   * фиксированный order_hash и подписанный оператором signiss1-акт (агрегат для
   * контрподписи), плюс единое Заявление о конвертации на весь дефицит сверх
   * уже внесённых членских средств. Если членских хватает — convert == null,
   * подписывать нужно только сами акты получения.
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

    const feePercent = await this.economyService.getMembershipFeeContractPercent(coopname);

    // По строке: фиксированный order_hash (из бандла) + агрегат signiss1-акта,
    // уже подписанного оператором, чтобы пайщик контрподписал его (signiss2).
    // Плюс суммарная потребность в членских средствах для разложения сумм.
    const order_lines: MarketplaceStockAcceptOrderLine[] = [];
    let neededUnits = 0n;
    for (const item of proposal.items) {
      if (!item.order_hash || !item.signiss1_act) {
        throw new ConflictException(
          'Докладка сформирована в устаревшем формате (без подписи оператора) — переформируйте её у стойки.'
        );
      }
      const signiss1_aggregate = await this.documentDomainService.buildDocumentAggregate(
        item.signiss1_act
      );
      if (!signiss1_aggregate) {
        throw new ConflictException(
          `Исходник акта выдачи по строке «${item.product_name}» не найден в сторе — переформируйте докладку.`
        );
      }
      order_lines.push({
        offer_id: item.offer_id,
        order_hash: item.order_hash,
        signiss1_aggregate,
      });
      // Конвертация паевого нужна ТОЛЬКО под докладку (строка без order_id):
      // её полная стоимость блокируется с членского на stockorder. Обычный
      // заказ уже профондирован с паевого на createorder — доплату по факту
      // (overage) signiss2 берёт с членского сам и фейлится при нехватке.
      if (!item.order_id) {
        neededUnits += this.economyService.lineUnits(item.unit_price, item.quantity, feePercent);
      }
    }

    // Дефицит = потребность − уже внесённые членские средства. Конвертируем
    // только его, одним заявлением.
    const memberUnits = await this.readMemberUnits(coopname, member_account);
    const deficitUnits = neededUnits > memberUnits ? neededUnits - memberUnits : 0n;
    // Покрытие имеющимися членскими = вся стоимость минус дефицит (= min(needed, member)).
    const coveredUnits = neededUnits - deficitUnits;
    const member_amount = this.economyService.unitsToAsset(coveredUnits);

    if (deficitUnits === 0n) {
      return { member_amount, order_lines, convert: null };
    }

    const amount = this.economyService.unitsToAsset(deficitUnits);
    const convert_hash = computeConvertAnchorHash(coopname, member_account, proposal_id);
    const action: Cooperative.Registry.MarketplaceConvertStatement.Action = {
      registry_id: Cooperative.Registry.MarketplaceConvertStatement.registry_id,
      coopname,
      username: member_account,
      lang: 'ru',
      order_hash: convert_hash,
      amount,
      skip_save: false,
    };
    const document = await this.documentDomainService.generateDocument({ data: action });
    return { member_amount, order_lines, convert: { amount, convert_hash, document } };
  }

  /** Баланс членского кошелька «Стола заказов» пайщика в минимальных единицах. */
  private async readMemberUnits(coopname: string, member_account: string): Promise<bigint> {
    const wallet = await this.userWalletRepo.findByWalletAndUsername(
      coopname,
      'w.mkt.member',
      member_account
    );
    return wallet?.available ? this.economyService.assetToUnits(wallet.available) : 0n;
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
   * Заказ обязан быть ACCEPTED_TO_COOP без открытой выдачи, принадлежать
   * адресату бандла и выдаваться ИМЕННО с этого КУ. order_hash берётся из
   * заказа (бэкенд авторитетен), product_name — из оффера заказа.
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
    if (!line.signiss1_act?.signatures?.length) {
      throw new BadRequestException(
        'Строка заказа без подписи оператора (signiss1) — переподпишите выдачу.'
      );
    }
    const order = await this.orderRepo.findById(line.order_id);
    if (!order || order.coopname !== coopname) {
      throw new NotFoundException(`Заказ ${line.order_id} не найден.`);
    }
    if (order.orderer_account !== member_account) {
      throw new BadRequestException(
        'Заказ принадлежит другому пайщику — нельзя включить его в бандл этого получателя.'
      );
    }
    if (order.delivery_braname !== braname) {
      throw new BadRequestException(
        `Заказ выдаётся на другом КУ (${order.delivery_braname}), со стойки ${braname} не выдаётся.`
      );
    }
    if (!order.awaits_chairman_issue_open) {
      throw new ConflictException(
        `Заказ ${order.id} (статус «${order.status}») не готов к открытию выдачи.`
      );
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
      order_hash: order.order_hash,
      signiss1_act: line.signiss1_act,
    };
  }

  /**
   * Нагрузка оператору для подписи signiss1 при формировании бандла докладки.
   * По строке: детерминированный order_hash (он же уйдёт в будущий stockorder) +
   * сгенерированный АПП-выдачи (registry 1105), который оператор подписывает
   * своим ключом первой подписью. Заказ ещё НЕ создаётся — он родится на
   * финализации, когда пайщик контрподпишет акт (одна кнопка).
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
      const { offer, resolved } = await this.validateStockLine(
        input.coopname,
        input.braname,
        item.offer_id,
        item.quantity,
        item.package_id
      );
      const order_hash = computeStockOrderHash(input.coopname, input.member_account, offer.id);
      const signiss1_document = await this.issuanceService.generateStockIssueActDocument({
        coopname: input.coopname,
        orderer_account: input.member_account,
        order_hash,
        braname: input.braname,
        transmitter: input.operator_account,
        offer_id: offer.id,
        product_title: offer.product_name,
        unit_of_measurement: marketplaceOrderUnitLabel(offer.unit_of_measure),
        unit_of_measure: offer.unit_of_measure,
        package_size: resolved.packageSize,
        quantity: resolved.baseQuantity,
        unit_price: resolved.unitPrice,
      });
      lines.push({
        offer_id: offer.id,
        quantity: item.quantity,
        order_hash,
        unit_price: resolved.unitPrice,
        product_name: offer.product_name,
        package_id: resolved.packageId,
        package_size: resolved.packageSize,
        signiss1_document,
      });
    }
    return lines;
  }

  async createProposal(
    input: MarketplaceStockProposalCreateInput
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const orderLines = input.order_items ?? [];
    if (input.items.length === 0 && orderLines.length === 0) {
      throw new BadRequestException('Бандл пуст — добавьте позиции заказа или докладку со склада.');
    }

    // Единый бандл несёт строки двух видов:
    //  • докладка — активные офферы остатка ИМЕННО этого КУ, кол-во в пределах
    //    остатка; заказ родится на финализации.
    //  • обычный заказ — уже существующий ACCEPTED_TO_COOP заказ пайщика
    //    (профондирован с паевого), сразу к выдаче.
    // Каждая строка несёт order_hash и подписанный оператором signiss1-акт —
    // пайщику останется одна подпись.
    const items: MarketplaceStockProposalItem[] = [];
    for (const line of input.items) {
      const { offer, resolved } = await this.validateStockLine(
        input.coopname,
        input.braname,
        line.offer_id,
        line.quantity,
        line.package_id
      );
      if (!line.order_hash) {
        throw new BadRequestException('Строка без order_hash — переформируйте докладку.');
      }
      if (!line.signiss1_act?.signatures?.length) {
        throw new BadRequestException(
          'Строка без подписи оператора (signiss1) — переподпишите докладку.'
        );
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
        signiss1_act: line.signiss1_act,
      });
    }
    for (const line of orderLines) {
      items.push(
        await this.buildOrderItem(input.coopname, input.braname, input.member_account, line)
      );
    }

    const proposal = await this.proposalRepo.create({
      coopname: input.coopname,
      braname: input.braname,
      member_account: input.member_account,
      operator_account: input.operator_account,
      items,
    });

    const event: MarketplaceStockProposalCreatedEvent = {
      coopname: proposal.coopname,
      proposal_id: proposal.id,
      member_account: proposal.member_account,
      braname: proposal.braname,
    };
    this.eventBus.emit(MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT, event);

    this.logger.log(
      `Докладка: предложение ${proposal.id} пайщику ${proposal.member_account} (${items.length} строк, КУ ${proposal.braname}, оператор ${input.operator_account}).`
    );
    return proposal;
  }

  /**
   * Пайщик ОДНОЙ подписью утверждает докладку как акт. При дефиците — сперва
   * конвертация паевого по подписанному Заявлению; затем по каждой строке:
   * заказ из остатка (stockorder) → открытие выдачи подписанным ОПЕРАТОРОМ актом
   * (signiss1) → закрытие контрподписью ПАЙЩИКА (signiss2), заказ сразу RECEIVED.
   *
   * Фаза создания заказов атомарна (на фейле — компенсирующая отмена всех
   * созданных, они ещё ACCEPTED_TO_COOP). Подписи signiss1/signiss2 идут после:
   * документы провалидированы заранее, фейл здесь маловероятен и не откатывается
   * (заказ уже выдаётся) — логируем для ручной достройки оператором.
   */
  async finalizeStockIssuance(
    coopname: string,
    proposal_id: string,
    member_account: string,
    input: MarketplaceStockFinalizeInput
  ): Promise<MarketplaceStockProposalAcceptResult> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Подписать докладку может только её адресат.');
    }
    this.assertProposed(proposal);

    const feePercent = await this.economyService.getMembershipFeeContractPercent(coopname);

    // signiss2-акт по order_hash строки (уникален в бандле; offer_id мог бы
    // совпасть у двух обычных заказов одного оффера).
    const signiss2ByHash = new Map(
      (input.order_lines ?? []).map((l) => [l.order_hash, l.signed_signiss2_act])
    );

    // ── 0) Контрольная сверка: пайщик подписал РОВНО тот акт, что мы выдали ──
    //    Защита от подмены тела («выдали вагон алюминия»): по каждой строке
    //    контрподписанный пайщиком документ обязан совпасть с сохранённым
    //    signiss1-актом оператора и пройти крипто-/структурную валидацию. Делаем
    //    ДО любых транзакций и блокировок средств — на подмене падаем рано.
    for (const item of proposal.items) {
      if (!item.order_hash || !item.signiss1_act) {
        throw new ConflictException(
          'Бандл в устаревшем формате (без подписи оператора) — переформируйте его у стойки.'
        );
      }
      const submitted = signiss2ByHash.get(item.order_hash);
      if (!submitted) {
        throw new BadRequestException(
          'Состав подписания не совпадает с бандлом — обновите подписание.'
        );
      }
      await this.assertCountersignMatchesStored(item, submitted, member_account);
    }

    // Потребность и дефицит сверх членских — ТОЛЬКО по докладке (как в
    // getAcceptSignablePayloads; суммы обязаны совпасть с подписанным Заявлением).
    // Обычный заказ профондирован с паевого ранее и в дефицит не входит.
    let neededUnits = 0n;
    for (const item of proposal.items) {
      if (!item.order_id) {
        neededUnits += this.economyService.lineUnits(item.unit_price, item.quantity, feePercent);
      }
    }
    const memberUnits = await this.readMemberUnits(coopname, member_account);
    const deficitUnits = neededUnits > memberUnits ? neededUnits - memberUnits : 0n;

    // ── 1) Дефицит — ОДНА конвертация паевого по подписанному Заявлению ──────
    if (deficitUnits > 0n) {
      if (!input.signed_convert) {
        throw new BadRequestException(
          'Нет подписанного Заявления о конвертации паевого взноса — обновите подписание докладки.'
        );
      }
      const meta = input.signed_convert.meta;
      const expectedAmount = this.economyService.unitsToAsset(deficitUnits);
      const expectedHash = computeConvertAnchorHash(coopname, member_account, proposal_id);
      if (
        meta.registry_id !== Cooperative.Registry.MarketplaceConvertStatement.registry_id ||
        meta.order_hash !== expectedHash ||
        meta.amount !== expectedAmount
      ) {
        throw new BadRequestException(
          'Заявление о конвертации не соответствует сумме доплаты — обновите подписание.'
        );
      }
      const convert_statement = new SignedDigitalDocumentInputDTO(
        input.signed_convert
      ).toDocument() as MarketContract.Actions.Convert.IConvert['convert_statement'];
      await this.stockService.convertToMember({
        coopname,
        orderer: member_account,
        amount: expectedAmount,
        convert_statement,
      });
    }

    // ── 2) Заказы к выдаче: докладка → создаём из остатка (атомарно, на фейле —
    //    отмена созданных); обычный заказ → уже существует, берём его order_id.
    const issuables: Array<{
      order_id: string;
      item: MarketplaceStockProposalItem;
      signiss2: MarketplaceIssueActSignedDocumentInputDTO;
    }> = [];
    const createdStock: Array<{ order_id: string }> = [];
    try {
      for (const item of proposal.items) {
        if (!item.order_hash || !item.signiss1_act) {
          throw new ConflictException(
            'Бандл в устаревшем формате (без подписи оператора) — переформируйте его у стойки.'
          );
        }
        const signiss2 = signiss2ByHash.get(item.order_hash);
        if (!signiss2) {
          throw new BadRequestException(
            'Состав подписания не совпадает с бандлом — обновите подписание.'
          );
        }
        if (item.order_id) {
          // Обычный заказ — уже ACCEPTED_TO_COOP, создавать нечего.
          issuables.push({ order_id: item.order_id, item, signiss2 });
          continue;
        }
        // Докладка: средства уже в членском (конвертация выше при дефиците) — без Заявления.
        const { order } = await this.stockService.createStockOrder({
          coopname,
          orderer_account: member_account,
          offer_id: item.offer_id,
          quantity: item.quantity,
          package_id: item.package_id ?? null,
          checkout_id: proposal.id,
          order_hash: item.order_hash,
        });
        createdStock.push({ order_id: order.id });
        issuables.push({ order_id: order.id, item, signiss2 });
      }
    } catch (error) {
      for (const { order_id } of createdStock) {
        try {
          await this.stockService.cancelStockOrder(
            coopname,
            order_id,
            member_account,
            'Подписание бандла не завершилось — строка отменена'
          );
        } catch (compErr: any) {
          this.logger.error(
            `finalizeStockIssuance: компенсирующая отмена stock-order ${order_id} упала: ${compErr.message}. РУЧНАЯ СВЕРКА!`
          );
        }
      }
      throw error;
    }

    // ── 3) Выдача: signiss1 оператора → signiss2 пайщика (заказ RECEIVED) ────
    const order_ids: string[] = [];
    for (const { order_id, item, signiss2 } of issuables) {
      await this.issuanceService.openIssuance({
        coopname,
        chairman_account: proposal.operator_account,
        order_id,
        actual_quantity: item.quantity,
        actual_unit_price: item.unit_price,
        signed_document: item.signiss1_act as unknown as MarketplaceIssueActSignedDocumentInputDTO,
      });
      await this.issuanceService.finalizeIssuance({
        coopname,
        orderer_account: member_account,
        order_id,
        signed_document: signiss2,
      });
      order_ids.push(order_id);
    }

    const resolved = await this.proposalRepo.applyResolution(
      proposal.id,
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.ACCEPTED,
      order_ids
    );
    if (!resolved) {
      // Гонка: оператор отозвал докладку, пока шла подпись. Заказы уже выданы
      // (RECEIVED) — откатить нельзя; подпись пайщика первична. Логируем.
      this.logger.warn(
        `finalizeStockIssuance: бандл ${proposal.id} отозван в гонке, но заказы уже выданы (${order_ids.join(',')}).`
      );
      const stale = await this.loadProposal(coopname, proposal_id);
      this.emitResolved(stale);
      return { proposal: stale, order_ids };
    }

    this.emitResolved(resolved);
    this.logger.log(
      `Докладка ${proposal.id} подписана пайщиком ${member_account}: выдано позиций — ${order_ids.length}.`
    );
    return { proposal: resolved, order_ids };
  }

  /** Пайщик отказывается от предложения. */
  async declineProposal(
    coopname: string,
    proposal_id: string,
    member_account: string
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Отказаться от предложения может только его адресат.');
    }
    this.assertProposed(proposal);
    const resolved = await this.proposalRepo.applyResolution(
      proposal.id,
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.DECLINED
    );
    if (!resolved) throw new ConflictException('Предложение уже разрешено.');
    this.emitResolved(resolved);
    return resolved;
  }

  /** Оператор отзывает предложение (переформирование «а ещё сметаны положите»). */
  async cancelProposal(
    coopname: string,
    proposal_id: string,
    operator_account: string
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    this.assertProposed(proposal);
    const resolved = await this.proposalRepo.applyResolution(
      proposal.id,
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.CANCELLED
    );
    if (!resolved) throw new ConflictException('Предложение уже разрешено.');
    this.emitResolved(resolved);
    this.logger.log(`Докладка ${proposal.id} отозвана оператором ${operator_account}.`);
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

  private async loadProposal(
    coopname: string,
    proposal_id: string
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.proposalRepo.findById(proposal_id);
    if (!proposal || proposal.coopname !== coopname) {
      throw new NotFoundException('Предложение докладки не найдено.');
    }
    return proposal;
  }

  /**
   * Контрольная сверка контрподписанного пайщиком акта со ВЗ сохранённым актом
   * оператора. Закрывает вектор подмены: пайщику передаётся signiss1-акт
   * оператора на его устройство, и без сверки он мог бы подписать ПОДМЕНЁННОЕ
   * тело (другой товар/количество) и вернуть его — мы бы выдали не то.
   *
   * Бьёт, если: тело/мета не совпадают с выданным к подписи; подпись оператора
   * не сохранена/подменена; пайщик не подписал; документ не прошёл крипто-,
   * структурную валидацию или сверку тела с оригиналом в сторе (канон-валидатор
   * recompute'ит signed_hash из doc_hash+meta_hash, поэтому произвольный hash не
   * пройдёт). Контракт дополнительно режет подделку on-chain
   * (verify_document_or_fail требует валидную подпись оператора над телом) — это
   * defence-in-depth и ранний внятный отказ.
   */
  private async assertCountersignMatchesStored(
    item: MarketplaceStockProposalItem,
    submitted: MarketplaceIssueActSignedDocumentInputDTO,
    member_account: string
  ): Promise<void> {
    const stored = item.signiss1_act!;
    const sub = submitted as unknown as ISignedDocumentDomainInterface;
    const label = item.product_name || item.offer_id;

    // 1. Тот же документ, что подписал оператор: тело и мета НЕ подменены.
    if (sub.doc_hash !== stored.doc_hash || sub.meta_hash !== stored.meta_hash) {
      throw new ForbiddenException(
        `Подписанный акт по «${label}» не совпадает с выданным к подписи — подпись отклонена.`
      );
    }

    // 2. Подпись оператора (первая) сохранена нетронутой — её не подменили.
    const opSig = stored.signatures?.[0];
    const opPreserved =
      !!opSig &&
      sub.signatures.some(
        (s) =>
          s.signer === opSig.signer &&
          s.signature === opSig.signature &&
          s.public_key === opSig.public_key
      );
    if (!opPreserved) {
      throw new ForbiddenException(
        `Подпись оператора по «${label}» утеряна или подменена — подпись отклонена.`
      );
    }

    // 3. Пайщик подписал акт своим ключом (вторая подпись, получение).
    if (!sub.signatures.some((s) => s.signer === member_account)) {
      throw new ForbiddenException(
        `Акт по «${label}» не подписан получателем — подпись отклонена.`
      );
    }

    // 4. Крипто + структура + сверка тела с оригиналом в сторе документов.
    const validation = await this.documentValidationService.validateSignedDocument(
      item.offer_id,
      sub
    );
    if (!validation.is_valid) {
      throw new ForbiddenException(
        `Акт по «${label}» не прошёл проверку подлинности: ${validation.error_message ?? 'причина не указана'}.`
      );
    }
  }

  private assertProposed(proposal: MarketplaceStockProposalDomainEntity): void {
    if (proposal.status !== MarketplaceStockProposalStatuses.PROPOSED) {
      throw new ConflictException(
        `Предложение уже разрешено (статус «${proposal.status}»).`
      );
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
