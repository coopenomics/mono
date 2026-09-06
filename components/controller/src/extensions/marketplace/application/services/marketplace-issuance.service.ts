import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cooperative, SovietContract, type MarketContract } from 'cooptypes';
import { PublicKey, Signature } from '@wharfkit/antelope';
import {
  LOGGER_PORT,
  type ILoggerPort,
  DOCUMENT_PORT,
  type IDocumentPort,
  type InnerGeneratedDocument,
  type InnerDocumentAggregate,
  VERIFICATION_PORT,
  type IVerificationPort,
  SOVIET_ROBOT_PORT,
  type ISovietRobotPort,
  type ISignedDocument,
} from '@coopenomics/innercoop';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_ISSUANCE_SAGA_REPOSITORY,
  type MarketplaceIssuanceSagaDomainRepository,
} from '../../domain/repositories/marketplace-issuance-saga.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { computeActNumber } from '../shared/act-number.util';
import { marketplaceOrderUnitLabel } from '../shared/unit-label.util';
import { presentSaleUnit } from '../shared/packaging.util';
import { calcCostAmount, compareMoney } from '../shared/cost.util';
import { isStockOrder } from '../shared/order-kind.util';
import { MARKETPLACE_ISSUE_ACTION_CODE } from '../shared/verification-action.const';
import { toQuantityAsset } from '../shared/quantity.util';
import { findInlineActionData } from '../shared/chain-trace.util';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderIssuanceFactSnapshot } from '../../domain/entities/marketplace-order.types';
import type { MarketplaceIssuanceSagaDomainEntity } from '../../domain/entities/marketplace-issuance-saga.entity';
import {
  MarketplaceIssuanceSagaStages,
  type MarketplaceIssuanceDecisionMode,
  type MarketplaceIssuanceSagaFact,
  type MarketplaceIssuanceSagaStage,
} from '../../domain/entities/marketplace-issuance-saga.types';
import {
  MARKETPLACE_ISSUANCE_DECIDED_OFFLINE_EVENT,
  MARKETPLACE_ISSUANCE_SAGA_UPDATED_EVENT,
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
  type MarketplaceIssuanceDecidedOfflineEvent,
  type MarketplaceIssuanceSagaUpdatedEvent,
  type MarketplaceOrderReadyToReceiveEvent,
} from '../events/marketplace-notification.events';
import type { MarketplaceShareReturnStatementSignedInputDTO } from '../documents-dto/marketplace-share-return-statement-document.dto';
import type { MarketplaceConvertStatementSignedInputDTO } from '../documents-dto/marketplace-convert-statement-document.dto';
import { MARKETPLACE_CONVERT_SERVICE, MarketplaceConvertService } from './marketplace-convert.service';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import type { MarketplaceShareReturnActSignedInputDTO } from '../documents-dto/marketplace-share-return-act-document.dto';

export interface MarketplaceIssuanceFixFactInput {
  coopname: string;
  operator_account: string;
  order_id: string;
  /** Бандл у стойки, если выдача идёт в его составе. */
  proposal_id?: string | null;
  actual_quantity: number;
  actual_unit_price: string;
}

export interface MarketplaceIssuanceSubmitStatementInput {
  coopname: string;
  member_account: string;
  order_id: string;
  signed_statement: MarketplaceShareReturnStatementSignedInputDTO;
  /**
   * Заявление 1110 на доплату по факту: при факте больше заказа и нехватке
   * внутреннего членского кошелька на довзнос участка. Перевод членской части
   * идёт отдельной транзакцией `convert` до заявления о выдаче. Нужно только
   * когда `getConvertSignablePayload` вернул документ.
   */
  signed_convert?: MarketplaceConvertStatementSignedInputDTO | null;
}

/** Доплата по факту (факт больше заказа), в минимальных единицах. */
export interface MarketplaceIssuanceFeeTopUp {
  /** Доплата тела: факт минус заказ; 0 — факт не больше заказа. */
  body_topup_units: bigint;
  /** Недостающий взнос участка сверх зафиксированного в заказе; 0 — довзноса нет. */
  topup_units: bigint;
  /** Полный взнос участка по факту выдачи. */
  fact_fee_units: bigint;
}

export interface MarketplaceIssuanceSignAct1Input {
  coopname: string;
  member_account: string;
  order_id: string;
  signed_act: MarketplaceShareReturnActSignedInputDTO;
}

export interface MarketplaceIssuanceCloseInput {
  coopname: string;
  operator_account: string;
  order_id: string;
  signed_act: MarketplaceShareReturnActSignedInputDTO;
}

/** Сколько ждать робота решений совета у стойки, прежде чем отпустить мутацию в режим ожидания. */
const ROBOT_WAIT_MS = 12_000;
/** Сколько ждать материализации решения в цепи после issuestmt (парсер и узел). */
const DECISION_LOOKUP_ATTEMPTS = 6;
const DECISION_LOOKUP_DELAY_MS = 700;

/**
 * Выдача имущества в паевой модели (компонент 68, задачи 99D-6/99D-7).
 *
 * Путь: оператор фиксирует факт у стойки (`fixFact`) → заказчик одним
 * нажатием подписывает Заявление 1113 (`submitStatement` → `issuestmt` +
 * повестка совета) → совет решает: робот решений совета по прямому вызову
 * порта либо люди в повестке → обратный вызов `onmktisauth` приносит
 * протокол 1114, бэкенд формирует Акт 1115 (`onCouncilAuthorized`) →
 * устройство заказчика подписывает акт первой подписью без нового нажатия
 * (`signAct1` → `issueact1`) → устройство оператора ставит закрывающую
 * подпись (`closeIssuance` → `issueact2`), и только тут идут движения по
 * средствам и складу.
 *
 * Сагу ведёт бэкенд: одна запись на заказ, этапы идемпотентны, при обрыве
 * связи у пайщика процесс продолжается до точки, где нужна его подпись;
 * при возвращении в приложение экран открывается на текущем этапе.
 *
 * Режим ожидания решения: если робот не установлен, выключен или не смог
 * набрать кворум делегировавших, сага остаётся в DECISION_PENDING сколько
 * потребуется (решение совета может приниматься часами), пайщик получает
 * уведомление, когда совет решит, и подписывает акт с любого места; выдача
 * закрывается при его следующем визите на участок.
 */
@Injectable()
export class MarketplaceIssuanceService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_ISSUANCE_SAGA_REPOSITORY)
    private readonly sagaRepo: MarketplaceIssuanceSagaDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(MARKETPLACE_CONVERT_SERVICE) private readonly convertService: MarketplaceConvertService,
    @Inject(MARKETPLACE_ECONOMY_SERVICE) private readonly economyService: MarketplaceEconomyService,
    @Inject(VERIFICATION_PORT) private readonly verificationPort: IVerificationPort,
    @Optional()
    @Inject(SOVIET_ROBOT_PORT)
    private readonly robotPort: ISovietRobotPort | null | undefined,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceIssuanceService.name);
  }

  // ── Готовность к выдаче ──────────────────────────────────────────────

  /**
   * Оператор участка выдачи отмечает поступление имущества по заказу:
   * `readyissue` в цепи (acceptcoop → readyrecv, без подписи), заказчику —
   * push «приходите заберите». Идемпотентно: заказ уже в readyrecv — no-op.
   */
  async readyIssue(input: { coopname: string; order_id: string; operator_account: string }): Promise<MarketplaceOrderDomainEntity> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    if (order.status === 'READY_TO_RECEIVE') return order;
    if (order.status !== 'ACCEPTED_TO_COOP') {
      throw new ConflictException(`Заказ в статусе «${order.status}» — отметить готовность к выдаче нельзя.`);
    }
    const available = await this.loadAvailableOnWarehouse(order);
    if (available <= 0) {
      throw new ConflictException('По заказу ещё ничего не принято на склад пункта выдачи — объявить готовность нельзя.');
    }
    let tx;
    try {
      tx = await this.chainPort.readyIssue({
        coopname: order.coopname,
        signer: input.operator_account,
        order_hash: order.order_hash,
      });
    } catch (err) {
      throw new ConflictException(`Готовность к выдаче не отмечена в цепи: ${this.errMessage(err)}.`);
    }
    void this.extractTxHash(tx);
    const updated = await this.orderRepo.applyReadyIssue(order.id, { current_warehouse_braname: order.delivery_braname });
    const event: MarketplaceOrderReadyToReceiveEvent = {
      coopname: updated.coopname,
      order_id: updated.id,
      order_hash: updated.order_hash,
      orderer_account: updated.orderer_account,
      braname: updated.delivery_braname,
    };
    this.eventBus.emit(MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT, event);
    return updated;
  }

  // ── Этап 0: факт у стойки ─────────────────────────────────────────────

  /**
   * Оператор сверил состав и зафиксировал факт (количество, цена). Подписи нет;
   * сага рождается в FACT_FIXED, заказчику уходит сигнал «подпишите заявление».
   * Возвращает сагу и сформированное Заявление 1113 к подписи.
   */
  async fixFact(input: MarketplaceIssuanceFixFactInput): Promise<{ saga: MarketplaceIssuanceSagaDomainEntity; statement: InnerGeneratedDocument }> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    if (order.status !== 'READY_TO_RECEIVE' && order.status !== 'ACCEPTED_TO_COOP') {
      throw new ConflictException(`Заказ в статусе «${order.status}» — выдача недоступна.`);
    }
    if (!(input.actual_quantity > 0)) throw new BadRequestException('Фактическое количество должно быть больше нуля.');
    if (!(Number.parseFloat(input.actual_unit_price) > 0)) throw new BadRequestException('Фактическая цена за единицу должна быть больше нуля.');

    // Гейт верификации личности (105-28): имущество выдаётся только получателю с
    // подтверждённой личностью — сверка паспорта до подписи заявления.
    await this.assertRecipientVerified(order.orderer_account);

    // Выдать можно только принятое на склад по этому заказу и ещё не выданное.
    const available = await this.loadAvailableOnWarehouse(order);
    this.assertWithinWarehouse(order, input.actual_quantity, available);

    // Заказ из остатка: цену при выдаче можно только снизить (уценка), не поднять.
    if (isStockOrder(order) && Number.parseFloat(input.actual_unit_price) > Number.parseFloat(order.price_per_unit) + 1e-9) {
      throw new ConflictException('По заказу со склада кооператива цену при выдаче можно только снизить.');
    }

    const fact = this.buildFact(order, input.actual_quantity, input.actual_unit_price);
    const saga = await this.sagaRepo.createOrReuse({
      coopname: order.coopname,
      order_id: order.id,
      order_hash: order.order_hash,
      proposal_id: input.proposal_id ?? null,
      member_account: order.orderer_account,
      operator_account: input.operator_account,
      braname: order.delivery_braname,
      fact,
    });
    if (saga.stage !== MarketplaceIssuanceSagaStages.FACT_FIXED) {
      throw new ConflictException(`Выдача по заказу уже начата (этап «${saga.stage}») — дождитесь её завершения или отмените.`);
    }
    const statement = await this.generateStatementDocument(order, saga.fact);
    this.emitSagaUpdated(saga);
    return { saga, statement };
  }

  /** Заявление 1113 к подписи по живой саге (повторное открытие экрана пайщика). */
  async getStatementSignablePayload(coopname: string, order_id: string, member_account: string): Promise<InnerGeneratedDocument> {
    const order = await this.loadOrder(coopname, order_id);
    this.assertOrderer(order, member_account);
    const saga = await this.requireSaga(coopname, order.id);
    if (saga.stage !== MarketplaceIssuanceSagaStages.FACT_FIXED) {
      throw new ConflictException('Заявление уже подписано — следующий шаг за советом или актом.');
    }
    return this.generateStatementDocument(order, saga.fact);
  }

  /**
   * Довзнос членского взноса по факту: при факте больше заказа взнос участка
   * пересчитывается пропорционально (та же формула, что `pro_rata` контракта,
   * с округлением к ближайшему), и недостающее сверх зафиксированного в
   * заказе доплачивается с членского кошелька программы на закрывающей подписи.
   */
  feeTopUp(order: MarketplaceOrderDomainEntity, fact: MarketplaceIssuanceSagaFact): MarketplaceIssuanceFeeTopUp {
    const total = this.economyService.assetToUnits(order.total_cost);
    const factCost = this.economyService.assetToUnits(fact.fact_cost);
    const locked = order.membership_fee ? this.economyService.assetToUnits(order.membership_fee) : 0n;
    if (total <= 0n || factCost <= total) {
      return { body_topup_units: 0n, topup_units: 0n, fact_fee_units: locked };
    }
    const body_topup_units = factCost - total;
    if (locked <= 0n) {
      return { body_topup_units, topup_units: 0n, fact_fee_units: 0n };
    }
    const factFee = (locked * factCost + total / 2n) / total;
    return { body_topup_units, topup_units: factFee > locked ? factFee - locked : 0n, fact_fee_units: factFee };
  }

  /** Доплата по факту для заказа в саге на этапе «факт зафиксирован» (для плана бандла у стойки). */
  async getFeeTopUp(coopname: string, order_id: string, member_account: string): Promise<MarketplaceIssuanceFeeTopUp> {
    const order = await this.loadOrder(coopname, order_id);
    this.assertOrderer(order, member_account);
    const saga = await this.requireSaga(coopname, order.id);
    if (saga.stage !== MarketplaceIssuanceSagaStages.FACT_FIXED) return { body_topup_units: 0n, topup_units: 0n, fact_fee_units: 0n };
    return this.feeTopUp(order, saga.fact);
  }

  /**
   * Заявление 1110 на доплату по факту к подписи заказчиком — только если
   * факт больше заказа и внутреннего членского кошелька не хватает на довзнос
   * участка; иначе null и подпись не требуется. Сумма — недостающее со
   * свободного паевого: доплата тела и членская часть довзноса.
   */
  async getConvertSignablePayload(coopname: string, order_id: string, member_account: string): Promise<InnerGeneratedDocument | null> {
    const order = await this.loadOrder(coopname, order_id);
    this.assertOrderer(order, member_account);
    const saga = await this.requireSaga(coopname, order.id);
    if (saga.stage !== MarketplaceIssuanceSagaStages.FACT_FIXED) return null;
    const plan = await this.topUpPlan(coopname, order, saga.fact);
    if (!plan) return null;
    return this.convertService.generateStatement({
      coopname,
      username: order.orderer_account,
      anchor_hash: order.order_hash,
      amount_units: plan.amount_units,
      fee_units: plan.fee_units,
      source: 'market',
    });
  }

  /** Недостающее на доплату по факту: null — членского кошелька хватает или факт не больше заказа. */
  private async topUpPlan(
    coopname: string,
    order: MarketplaceOrderDomainEntity,
    fact: MarketplaceIssuanceSagaFact
  ): Promise<{ amount_units: bigint; fee_units: bigint } | null> {
    const topUp = this.feeTopUp(order, fact);
    if (topUp.topup_units <= 0n) return null;
    const memberAvailable = await this.convertService.memberAvailableUnits(coopname, order.orderer_account);
    const fee_units = this.convertService.shortfallUnits(memberAvailable, topUp.topup_units);
    if (fee_units <= 0n) return null;
    return { amount_units: topUp.body_topup_units + fee_units, fee_units };
  }

  // ── Этап 1: заявление ────────────────────────────────────────────────

  /**
   * Заказчик подписал Заявление 1113: `issuestmt` в цепи (повестка совета
   * ставится контрактом инлайн), сага → DECISION_PENDING с номером решения,
   * робот решений совета вызывается напрямую и ждётся у стойки до
   * ROBOT_WAIT_MS. Возвращает сагу на актуальном этапе: если совет успел
   * решить, в ней уже есть протокол и акт к подписи.
   */
  async submitStatement(input: MarketplaceIssuanceSubmitStatementInput): Promise<MarketplaceIssuanceSagaDomainEntity> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    this.assertOrderer(order, input.member_account);
    let saga = await this.requireSaga(input.coopname, order.id);

    // Идемпотентность: повтор мутации после обрыва связи возвращает сагу как есть.
    if (saga.stage !== MarketplaceIssuanceSagaStages.FACT_FIXED) {
      return this.settleAfterRobot(saga);
    }
    if (order.status !== 'READY_TO_RECEIVE') {
      throw new ConflictException(`Заказ в статусе «${order.status}» — подписать заявление нельзя.`);
    }

    const meta = input.signed_statement.meta;
    if (
      meta.registry_id !== Cooperative.Registry.MarketplaceShareReturnStatement.registry_id ||
      meta.order_hash !== order.order_hash
    ) {
      throw new BadRequestException('Заявление подписано для другого заказа — обновите экран выдачи.');
    }
    if (compareMoney(String(meta.total_amount), saga.fact.fact_cost, this.assetConfig.decimals) !== 0) {
      throw new BadRequestException('Состав в заявлении не совпадает с зафиксированным оператором — обновите экран выдачи.');
    }
    this.verifyDocumentSignature(input.signed_statement, order.orderer_account);

    // Довзнос по факту сверх внутреннего членского кошелька: заявление 1110 на
    // недостающее и перевод членской части отдельной транзакцией до заявления
    // о выдаче — контракт на issuestmt проверит, что кошелька теперь хватает.
    const topUp = await this.topUpPlan(input.coopname, order, saga.fact);
    if (topUp) {
      const convert_statement = this.convertService.verifySigned(
        input.signed_convert,
        { anchor_hash: order.order_hash, amount_units: topUp.amount_units, fee_units: topUp.fee_units },
        order.orderer_account
      );
      try {
        await this.chainPort.convert({
          coopname: order.coopname,
          orderer: order.orderer_account,
          amount: this.economyService.unitsToAsset(topUp.fee_units),
          from_market: true,
          convert_statement,
        });
      } catch (err) {
        const message = this.errMessage(err);
        await this.sagaRepo.update(saga.id, { last_error: message });
        throw new ConflictException(`Перевод в членский кошелёк не принят цепью: ${message}. Повторите подписание.`);
      }
    }

    const statement = new SignedDigitalDocumentInputDTO(input.signed_statement).toDocument() as MarketContract.Actions.IssueStmt.IIssueStmt['statement'];
    let tx;
    try {
      tx = await this.chainPort.issueStmt({
        coopname: order.coopname,
        orderer: order.orderer_account,
        order_hash: order.order_hash,
        actual_quantity: toQuantityAsset(saga.fact.actual_quantity, order.unit_of_measure),
        actual_unit_price: this.formatAsset(saga.fact.actual_unit_price),
        statement,
        meta: '',
      });
    } catch (err) {
      const message = this.errMessage(err);
      await this.sagaRepo.update(saga.id, { last_error: message });
      throw new ConflictException(`Заявление не принято цепью: ${message}. Повторите подписание.`);
    }
    const txHash = this.extractTxHash(tx);
    // Номер решения — из трассы транзакции инициатора (инлайн `soviet::newsubmitted`,
    // L20): без ожидания парсера. Не нашли — дочитаем из таблицы решений ниже.
    const tracedDecisionId = this.decisionIdFromTrace(tx);
    const moved = await this.sagaRepo.transition(saga.id, MarketplaceIssuanceSagaStages.FACT_FIXED, {
      stage: tracedDecisionId ? MarketplaceIssuanceSagaStages.DECISION_PENDING : MarketplaceIssuanceSagaStages.STATEMENT_SIGNED,
      decision_id: tracedDecisionId,
      statement_document: input.signed_statement as unknown as ISignedDocument,
      tx_hashes: { ...saga.tx_hashes, issuestmt: txHash },
      last_error: null,
    });
    saga = moved ?? (await this.requireSaga(input.coopname, order.id));
    await this.orderRepo.applyIssuanceStatement(order.id, { issuance_fact: this.toFactSnapshot(order, saga.fact) });
    this.emitSagaUpdated(saga);

    saga = await this.attachDecision(saga);
    return this.settleAfterRobot(saga);
  }

  /**
   * Номер решения совета по заявлению: читается из цепи по хэшу повестки
   * (= order_hash) с короткими повторами — узел материализует строку в тот
   * же блок, но чтение через парсер может отставать на секунду-другую.
   * Сага → DECISION_PENDING. Без номера остаёмся в STATEMENT_SIGNED: сторож
   * дочитает позже.
   */
  async attachDecision(saga: MarketplaceIssuanceSagaDomainEntity): Promise<MarketplaceIssuanceSagaDomainEntity> {
    if (saga.stage !== MarketplaceIssuanceSagaStages.STATEMENT_SIGNED) return saga;
    for (let i = 0; i < DECISION_LOOKUP_ATTEMPTS; i++) {
      const decision = await this.chainPort.findCouncilDecisionByHash(saga.coopname, saga.order_hash).catch(() => null);
      if (decision) {
        const moved = await this.sagaRepo.transition(saga.id, MarketplaceIssuanceSagaStages.STATEMENT_SIGNED, {
          stage: MarketplaceIssuanceSagaStages.DECISION_PENDING,
          decision_id: String(decision.id),
        });
        if (moved) {
          this.emitSagaUpdated(moved);
          return moved;
        }
        return (await this.sagaRepo.findById(saga.id)) ?? saga;
      }
      await this.sleep(DECISION_LOOKUP_DELAY_MS);
    }
    this.logger.warn(`Сага ${saga.id}: решение совета по заявлению ещё не видно в цепи — дочитает сторож.`);
    return saga;
  }

  /**
   * Прямой рычаг робота: просим принять решение сейчас и ждём у стойки. Исход
   * «утверждено» доводится обратным вызовом контракта через парсер — ждём,
   * пока слушатель переведёт сагу в DECISION_AUTHORIZED, чтобы вернуть акт к
   * подписи в том же ответе. Иначе сага остаётся в ожидании: пайщик увидит
   * спокойный экран, а уведомление придёт, когда совет решит.
   */
  private async settleAfterRobot(saga: MarketplaceIssuanceSagaDomainEntity): Promise<MarketplaceIssuanceSagaDomainEntity> {
    if (saga.stage !== MarketplaceIssuanceSagaStages.DECISION_PENDING || !saga.decision_id) return saga;
    const mode = await this.requestRobot(saga);
    if (mode !== 'ROBOT') return (await this.sagaRepo.findById(saga.id)) ?? saga;
    return this.waitForStage(saga.id, [MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED, MarketplaceIssuanceSagaStages.DECLINED], ROBOT_WAIT_MS);
  }

  /** Вызов робота; возвращает режим принятия решения, записанный в сагу. */
  async requestRobot(saga: MarketplaceIssuanceSagaDomainEntity): Promise<MarketplaceIssuanceDecisionMode> {
    if (!saga.decision_id) return saga.decision_mode;
    let mode: MarketplaceIssuanceDecisionMode = 'MANUAL';
    let detail: string | null = null;
    if (this.robotPort) {
      try {
        const enabled = await this.robotPort.isEnabled();
        if (enabled) {
          const result = await this.robotPort.requestDecision({
            coopname: saga.coopname,
            decision_id: Number(saga.decision_id),
            decision_type: 'mktissue',
            decision_hash: saga.order_hash,
            username: saga.member_account,
          });
          // Ждём у стойки только когда робот сам довёл решение (протокол в
          // цепи, обратный вызов уже в пути). «pending» (нет кворума, ждём
          // людей), «manual» (робот выключен) и «failed» — режим ожидания
          // людей: пайщик уходит, push придёт с решением.
          mode = result.outcome === 'authorized' || result.outcome === 'declined' ? 'ROBOT' : 'MANUAL';
          detail = result.detail ?? null;
          this.logger.log(`Сага ${saga.id}: робот решений совета ответил «${result.outcome}»${detail ? ` (${detail})` : ''}.`);
        }
      } catch (err) {
        // Робот упал — это его сторожу; для пайщика это режим ожидания людей.
        detail = this.errMessage(err);
        this.logger.warn(`Сага ${saga.id}: вызов робота решений совета не удался (${detail}); ждём решение людей.`);
        mode = 'MANUAL';
      }
    }
    await this.sagaRepo.update(saga.id, { decision_mode: mode, last_error: detail });
    return mode;
  }

  // ── Этап 2: решение совета (обратные вызовы контракта) ───────────────

  /**
   * `onmktisauth`: протокол получен. Сага → DECISION_AUTHORIZED, номер решения
   * из меты протокола, Акт 1115 сформирован и сохранён в сторе (исходник для
   * агрегата). Заказчику — сигнал (устройство подписывает акт само) и, если
   * решение шло вручную, push «подпишите акт».
   */
  async onCouncilAuthorized(input: { coopname: string; order_hash: string; protocol: ISignedDocument | null }): Promise<void> {
    const saga = await this.sagaRepo.findByOrderHash(input.coopname, input.order_hash);
    if (!saga) {
      this.logger.warn(`onmktisauth: сага по заказу ${input.order_hash} не найдена — решение совета без начатой выдачи.`);
      return;
    }
    if (saga.stage !== MarketplaceIssuanceSagaStages.STATEMENT_SIGNED && saga.stage !== MarketplaceIssuanceSagaStages.DECISION_PENDING) {
      this.logger.debug(`onmktisauth: сага ${saga.id} уже на этапе ${saga.stage} — повторный вызов пропущен.`);
      return;
    }
    const order = await this.loadOrder(input.coopname, saga.order_id);
    const decisionId = saga.decision_id ?? this.decisionIdFromProtocol(input.protocol);
    const act = await this.generateActDocument(order, saga, decisionId ?? '0');
    const moved = await this.sagaRepo.transition(saga.id, [MarketplaceIssuanceSagaStages.STATEMENT_SIGNED, MarketplaceIssuanceSagaStages.DECISION_PENDING], {
      stage: MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED,
      protocol_document: input.protocol,
      decision_id: decisionId,
      act_document_hash: act.hash,
      decided_at: new Date(),
      last_error: null,
    });
    if (!moved) return;
    await this.orderRepo.applyIssuanceAuthorized(order.id, { issue_decision_id: decisionId });
    this.emitSagaUpdated(moved);
    if (moved.decision_mode !== 'ROBOT') {
      const event: MarketplaceIssuanceDecidedOfflineEvent = {
        coopname: order.coopname,
        order_id: order.id,
        order_hash: order.order_hash,
        orderer_account: order.orderer_account,
        braname: order.delivery_braname,
        authorized: true,
      };
      this.eventBus.emit(MARKETPLACE_ISSUANCE_DECIDED_OFFLINE_EVENT, event);
    }
    this.logger.log(`Сага ${saga.id}: совет решил (№${decisionId ?? '?'}), акт ${act.hash} сформирован — ждём подпись заказчика.`);
  }

  /** `onmktisdecl`: совет отказал. Сага → DECLINED, заказ обратно в «готов к выдаче». */
  async onCouncilDeclined(input: { coopname: string; order_hash: string; reason: string }): Promise<void> {
    const saga = await this.sagaRepo.findByOrderHash(input.coopname, input.order_hash);
    if (!saga || !saga.awaits_council) return;
    const moved = await this.sagaRepo.transition(saga.id, [MarketplaceIssuanceSagaStages.STATEMENT_SIGNED, MarketplaceIssuanceSagaStages.DECISION_PENDING], {
      stage: MarketplaceIssuanceSagaStages.DECLINED,
      last_error: input.reason,
      decided_at: new Date(),
    });
    if (!moved) return;
    const order = await this.orderRepo.applyIssuanceReset(saga.order_id);
    this.emitSagaUpdated(moved);
    const event: MarketplaceIssuanceDecidedOfflineEvent = {
      coopname: order.coopname,
      order_id: order.id,
      order_hash: order.order_hash,
      orderer_account: order.orderer_account,
      braname: order.delivery_braname,
      authorized: false,
    };
    this.eventBus.emit(MARKETPLACE_ISSUANCE_DECIDED_OFFLINE_EVENT, event);
    this.logger.log(`Сага ${saga.id}: совет отказал (${input.reason}); заказ ${order.id} снова готов к выдаче.`);
  }

  // ── Этап 3: акт, первая подпись заказчика ─────────────────────────────

  /** Акт 1115 к первой подписи заказчика (исходник из стора по хэшу). */
  async getActSignablePayload(coopname: string, order_id: string, member_account: string): Promise<InnerGeneratedDocument> {
    const order = await this.loadOrder(coopname, order_id);
    this.assertOrderer(order, member_account);
    const saga = await this.requireSaga(coopname, order.id);
    if (saga.stage !== MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED) {
      throw new ConflictException(saga.awaits_council ? 'Совет ещё не принял решение по заявлению.' : `Акт на этом этапе («${saga.stage}») подписывать не нужно.`);
    }
    const stored = saga.act_document_hash ? await this.documentPort.getByHash(saga.act_document_hash) : null;
    if (stored) return stored;
    const regenerated = await this.generateActDocument(order, saga, saga.decision_id ?? '0');
    await this.sagaRepo.update(saga.id, { act_document_hash: regenerated.hash });
    return regenerated;
  }

  async signAct1(input: MarketplaceIssuanceSignAct1Input): Promise<MarketplaceIssuanceSagaDomainEntity> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    this.assertOrderer(order, input.member_account);
    const saga = await this.requireSaga(input.coopname, order.id);
    if (saga.stage === MarketplaceIssuanceSagaStages.ACT1_SIGNED || saga.stage === MarketplaceIssuanceSagaStages.CLOSED) return saga;
    if (saga.stage !== MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED) {
      throw new ConflictException(saga.awaits_council ? 'Совет ещё не принял решение по заявлению.' : `Выдача на этапе «${saga.stage}» — акт подписывать нельзя.`);
    }
    const meta = input.signed_act.meta;
    if (meta.registry_id !== Cooperative.Registry.MarketplaceShareReturnAct.registry_id || meta.order_hash !== order.order_hash) {
      throw new BadRequestException('Акт подписан для другого заказа — обновите экран.');
    }
    if (saga.act_document_hash && input.signed_act.doc_hash !== saga.act_document_hash) {
      throw new ForbiddenException('Подписанный акт не совпадает с выданным к подписи — подпись отклонена.');
    }
    this.verifyDocumentSignature(input.signed_act, order.orderer_account);
    const act = new SignedDigitalDocumentInputDTO(input.signed_act).toDocument() as MarketContract.Actions.IssueAct1.IIssueAct1['act'];
    let tx;
    try {
      tx = await this.chainPort.issueAct1({ coopname: order.coopname, orderer: order.orderer_account, order_hash: order.order_hash, act });
    } catch (err) {
      const message = this.errMessage(err);
      await this.sagaRepo.update(saga.id, { last_error: message });
      throw new ConflictException(`Подпись акта не принята цепью: ${message}. Повторите подписание.`);
    }
    const txHash = this.extractTxHash(tx);
    const moved = await this.sagaRepo.transition(saga.id, MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED, {
      stage: MarketplaceIssuanceSagaStages.ACT1_SIGNED,
      act1_document: input.signed_act as unknown as ISignedDocument,
      tx_hashes: { ...saga.tx_hashes, issueact1: txHash },
      last_error: null,
    });
    const result = moved ?? (await this.requireSaga(input.coopname, order.id));
    await this.orderRepo.applyIssuanceAct1(order.id);
    this.emitSagaUpdated(result);
    return result;
  }

  // ── Этап 4: закрывающая подпись оператора ─────────────────────────────

  /** Агрегат акта с первой подписью заказчика — оператор накладывает вторую. */
  async getCloseSignablePayload(coopname: string, order_id: string): Promise<InnerDocumentAggregate> {
    const order = await this.loadOrder(coopname, order_id);
    const saga = await this.requireSaga(coopname, order.id);
    if (saga.stage !== MarketplaceIssuanceSagaStages.ACT1_SIGNED || !saga.act1_document) {
      throw new ConflictException('Акт ещё не подписан заказчиком — закрывать нечего.');
    }
    const aggregate = await this.documentPort.buildAggregate(saga.act1_document);
    if (!aggregate) throw new ConflictException('Исходник акта не найден в сторе документов — переформируйте выдачу.');
    return aggregate;
  }

  /**
   * Закрывающая подпись председателя, доверенного или оператора участка:
   * `issueact2` — единственная точка движений по средствам. После успеха —
   * складской учёт (выданное ISSUED, остаток в обезличенный склад, уценка для
   * заказа из остатка), сага CLOSED, заказ RECEIVED. Имущество передаётся
   * заказчику после этого ответа.
   */
  async closeIssuance(input: MarketplaceIssuanceCloseInput): Promise<MarketplaceIssuanceSagaDomainEntity> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    const saga = await this.requireSaga(input.coopname, order.id);
    if (saga.stage === MarketplaceIssuanceSagaStages.CLOSED) return saga;
    if (saga.stage !== MarketplaceIssuanceSagaStages.ACT1_SIGNED || !saga.act1_document) {
      throw new ConflictException('Акт ещё не подписан заказчиком — закрыть выдачу нельзя.');
    }
    const sub = input.signed_act as unknown as ISignedDocument;
    const stored = saga.act1_document;
    if (sub.doc_hash !== stored.doc_hash || sub.meta_hash !== stored.meta_hash) {
      throw new ForbiddenException('Подписанный акт не совпадает с актом заказчика — подпись отклонена.');
    }
    const memberSig = stored.signatures?.[0];
    const memberPreserved = !!memberSig && sub.signatures.some((s) => s.signer === memberSig.signer && s.signature === memberSig.signature);
    if (!memberPreserved) throw new ForbiddenException('Подпись заказчика на акте утеряна или подменена — подпись отклонена.');
    if (!sub.signatures.some((s) => s.signer === input.operator_account)) {
      throw new ForbiddenException('Закрывающую подпись должен поставить оператор, закрывающий выдачу.');
    }
    this.verifyDocumentSignature(input.signed_act, input.operator_account);

    const act = new SignedDigitalDocumentInputDTO(input.signed_act).toDocument() as MarketContract.Actions.IssueAct2.IIssueAct2['act'];
    let tx;
    try {
      tx = await this.chainPort.issueAct2({ coopname: order.coopname, delivery_signer: input.operator_account, order_hash: order.order_hash, act });
    } catch (err) {
      const message = this.errMessage(err);
      await this.sagaRepo.update(saga.id, { last_error: message });
      throw new ConflictException(`Закрытие выдачи не принято цепью: ${message}. Имущество не передавайте, повторите закрытие.`);
    }
    const txHash = this.extractTxHash(tx);
    const factSnapshot = this.toFactSnapshot(order, saga.fact);
    const warrantyUntil = order.warranty_period_secs > 0 ? new Date(Date.now() + order.warranty_period_secs * 1000) : null;
    await this.orderRepo.applyIssuanceClosed(order.id, {
      delivery_signer_account: input.operator_account,
      issue_closed_tx_hash: txHash,
      issuance_fact: factSnapshot,
      warranty_until: warrantyUntil,
    });
    const moved = await this.sagaRepo.transition(saga.id, MarketplaceIssuanceSagaStages.ACT1_SIGNED, {
      stage: MarketplaceIssuanceSagaStages.CLOSED,
      act2_document: sub,
      tx_hashes: { ...saga.tx_hashes, issueact2: txHash },
      closed_at: new Date(),
      last_error: null,
    });
    const result = moved ?? (await this.requireSaga(input.coopname, order.id));
    await this.settleWarehouse(order, saga.fact);
    this.emitSagaUpdated(result);
    this.logger.log(`Выдача заказа ${order.id} закрыта оператором ${input.operator_account} (tx=${txHash}): факт ${saga.fact.actual_quantity}, сумма ${saga.fact.fact_cost}.`);
    return result;
  }

  /** Оператор отменяет начатую выдачу: `cancelissue`, сага CANCELLED, заказ снова готов к выдаче. */
  async cancelIssuance(input: { coopname: string; order_id: string; operator_account: string }): Promise<MarketplaceIssuanceSagaDomainEntity> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    const saga = await this.requireSaga(input.coopname, order.id);
    if (!saga.is_active) return saga;
    if (saga.awaits_council) {
      throw new ConflictException('Совет ещё рассматривает заявление — отменить выдачу можно после его ответа.');
    }
    if (saga.stage !== MarketplaceIssuanceSagaStages.FACT_FIXED) {
      try {
        await this.chainPort.cancelIssue({ coopname: order.coopname, signer: input.operator_account, order_hash: order.order_hash });
      } catch (err) {
        throw new ConflictException(`Отмена выдачи не принята цепью: ${this.errMessage(err)}.`);
      }
    }
    const moved = await this.sagaRepo.transition(saga.id, [MarketplaceIssuanceSagaStages.FACT_FIXED, MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED, MarketplaceIssuanceSagaStages.ACT1_SIGNED], {
      stage: MarketplaceIssuanceSagaStages.CANCELLED,
      closed_at: new Date(),
    });
    const result = moved ?? (await this.requireSaga(input.coopname, order.id));
    if (order.status !== 'READY_TO_RECEIVE') await this.orderRepo.applyIssuanceReset(order.id);
    this.emitSagaUpdated(result);
    return result;
  }

  // ── Чтение ───────────────────────────────────────────────────────────

  async getSagaByOrder(coopname: string, order_id: string): Promise<MarketplaceIssuanceSagaDomainEntity | null> {
    return this.sagaRepo.findActiveByOrderId(coopname, order_id) ?? this.sagaRepo.findByOrderHash(coopname, (await this.loadOrder(coopname, order_id)).order_hash);
  }

  async listSagas(filter: { coopname: string; member_account?: string; braname?: string | string[]; proposal_id?: string; active_only?: boolean }): Promise<MarketplaceIssuanceSagaDomainEntity[]> {
    return this.sagaRepo.list(filter);
  }

  /**
   * Сторож: дожимает саги, зависшие между этапами. STATEMENT_SIGNED без номера
   * решения — дочитать решение; DECISION_PENDING — повторно позвать робота
   * (не чаще раза в проход); DECISION_AUTHORIZED без акта — сформировать.
   */
  async watchdogTick(coopname: string, olderThan: Date, limit = 20): Promise<void> {
    const stale = await this.sagaRepo.findStale(coopname, [MarketplaceIssuanceSagaStages.STATEMENT_SIGNED, MarketplaceIssuanceSagaStages.DECISION_PENDING, MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED], olderThan, limit);
    for (const saga of stale) {
      try {
        if (saga.stage === MarketplaceIssuanceSagaStages.STATEMENT_SIGNED) {
          const decided = await this.attachDecision(saga);
          if (decided.stage === MarketplaceIssuanceSagaStages.DECISION_PENDING) await this.requestRobot(decided);
        } else if (saga.stage === MarketplaceIssuanceSagaStages.DECISION_PENDING) {
          if (saga.decision_mode === 'ROBOT' && saga.attempts < 5) {
            await this.sagaRepo.update(saga.id, { attempts: saga.attempts + 1 });
            await this.requestRobot(saga);
          } else {
            // Решение могло пройти мимо слушателя (перезапуск): сверяемся с цепью.
            const decision = saga.decision_id ? null : await this.chainPort.findCouncilDecisionByHash(coopname, saga.order_hash).catch(() => null);
            if (decision?.authorized) await this.onCouncilAuthorized({ coopname, order_hash: saga.order_hash, protocol: decision.authorization as unknown as ISignedDocument });
            else await this.sagaRepo.update(saga.id, { attempts: saga.attempts + 1 });
          }
        } else if (saga.stage === MarketplaceIssuanceSagaStages.DECISION_AUTHORIZED && !saga.act_document_hash) {
          const order = await this.loadOrder(coopname, saga.order_id);
          const act = await this.generateActDocument(order, saga, saga.decision_id ?? '0');
          await this.sagaRepo.update(saga.id, { act_document_hash: act.hash });
        }
      } catch (err) {
        this.logger.warn(`Сторож выдачи: сага ${saga.id} не дожата (${this.errMessage(err)}).`);
        await this.sagaRepo.update(saga.id, { last_error: this.errMessage(err), attempts: saga.attempts + 1 });
      }
    }
  }

  // ── Документы ────────────────────────────────────────────────────────

  /**
   * Заявление 1113 для строки докладки со склада: заказа ещё нет (он родится
   * на подписи пайщика по детерминированному order_hash), поэтому документ
   * строится из оффера и факта строки. Факт считается той же формулой, что и
   * для существующего заказа — суммы обязаны совпасть с сагой, которая
   * появится после создания заказа.
   */
  async generateStatementPreview(input: {
    coopname: string;
    orderer_account: string;
    order_hash: string;
    braname: string;
    offer_id: string;
    product_title: string;
    unit_of_measure: MarketplaceOrderDomainEntity['unit_of_measure'];
    package_size: number;
    /** Количество в БАЗОВОЙ единице. */
    actual_quantity: number;
    actual_unit_price: string;
  }): Promise<InnerGeneratedDocument> {
    const decimals = this.assetConfig.decimals;
    const unit_cost = Number.parseFloat(input.actual_unit_price).toFixed(decimals);
    const total_amount = calcCostAmount({
      quantity: input.actual_quantity,
      unit: input.unit_of_measure,
      unitPrice: unit_cost,
      packageSize: input.package_size,
      decimals,
    });
    const unit = presentSaleUnit(input.actual_quantity, input.unit_of_measure, input.package_size);
    const action: Cooperative.Registry.MarketplaceShareReturnStatement.Action = {
      registry_id: Cooperative.Registry.MarketplaceShareReturnStatement.registry_id,
      coopname: input.coopname,
      username: input.orderer_account,
      lang: 'ru',
      order_id: computeActNumber(input.order_hash),
      order_hash: input.order_hash,
      braname: input.braname,
      sku: input.offer_id,
      product_title: input.product_title,
      unit_of_measurement: unit.unitLabel || marketplaceOrderUnitLabel(input.unit_of_measure),
      fact_quantity: unit.units,
      unit_cost,
      total_amount,
      currency: this.assetConfig.symbol,
      skip_save: false,
    };
    return this.documentPort.generate({ data: action });
  }

  private async generateStatementDocument(order: MarketplaceOrderDomainEntity, fact: MarketplaceIssuanceSagaFact): Promise<InnerGeneratedDocument> {
    const offer = await this.offerRepo.findById(order.offer_id);
    const unit = presentSaleUnit(fact.actual_quantity, order.unit_of_measure, order.package_size);
    const action: Cooperative.Registry.MarketplaceShareReturnStatement.Action = {
      registry_id: Cooperative.Registry.MarketplaceShareReturnStatement.registry_id,
      coopname: order.coopname,
      username: order.orderer_account,
      lang: 'ru',
      order_id: order.id,
      order_hash: order.order_hash,
      braname: order.delivery_braname,
      sku: order.offer_id,
      product_title: offer?.product_name ?? 'Товар по предложению',
      unit_of_measurement: unit.unitLabel || (offer ? marketplaceOrderUnitLabel(offer.unit_of_measure) : ''),
      fact_quantity: unit.units,
      unit_cost: fact.actual_unit_price,
      total_amount: fact.fact_cost,
      currency: this.assetConfig.symbol,
      // Тело сохраняется в стор: заявление уходит в повестку совета, а
      // протокол и акт строятся из его меты (робот и рабочий стол совета).
      skip_save: false,
    };
    return this.documentPort.generate({ data: action });
  }

  private async generateActDocument(order: MarketplaceOrderDomainEntity, saga: MarketplaceIssuanceSagaDomainEntity, decision_id: string): Promise<InnerGeneratedDocument> {
    const offer = await this.offerRepo.findById(order.offer_id);
    const unit = presentSaleUnit(saga.fact.actual_quantity, order.unit_of_measure, order.package_size);
    const action: Cooperative.Registry.MarketplaceShareReturnAct.Action = {
      registry_id: Cooperative.Registry.MarketplaceShareReturnAct.registry_id,
      coopname: order.coopname,
      username: order.orderer_account,
      lang: 'ru',
      order_id: order.id,
      order_hash: order.order_hash,
      decision_id: Number(decision_id) || 0,
      act_id: computeActNumber(order.order_hash),
      transmitter: saga.operator_account,
      braname: order.delivery_braname,
      sku: order.offer_id,
      product_title: offer?.product_name ?? 'Товар по предложению',
      unit_of_measurement: unit.unitLabel || (offer ? marketplaceOrderUnitLabel(offer.unit_of_measure) : ''),
      fact_quantity: unit.units,
      unit_cost: saga.fact.actual_unit_price,
      total_amount: saga.fact.fact_cost,
      currency: this.assetConfig.symbol,
      // Исходник в сторе: заказчик подписывает его первым, оператор берёт
      // агрегат по doc_hash и накладывает закрывающую подпись без регенерации.
      skip_save: false,
    };
    return this.documentPort.generate({ data: action });
  }

  // ── Вспомогательное ──────────────────────────────────────────────────

  /**
   * Факт выдачи: `actual_quantity` — в БАЗОВОЙ единице, при отпуске упаковкой
   * `actual_unit_price` — цена ЗА УПАКОВКУ (канон единицы отпуска). Сумму
   * считает общая формула `calcCostAmount` — та же, что применит контракт.
   */
  private buildFact(order: MarketplaceOrderDomainEntity, actual_quantity: number, actual_unit_price: string): MarketplaceIssuanceSagaFact {
    const decimals = this.assetConfig.decimals;
    const fact_unit_price = Number.parseFloat(actual_unit_price).toFixed(decimals);
    const fact_cost = calcCostAmount({
      quantity: actual_quantity,
      unit: order.unit_of_measure,
      unitPrice: fact_unit_price,
      packageSize: order.package_size,
      decimals,
    });
    return { actual_quantity, actual_unit_price: fact_unit_price, fact_cost };
  }

  /** diff_state — по стоимости: именно она определяет ветку возврата/доплаты на issueact2. */
  private toFactSnapshot(order: MarketplaceOrderDomainEntity, fact: MarketplaceIssuanceSagaFact): MarketplaceOrderIssuanceFactSnapshot {
    const cmp = compareMoney(fact.fact_cost, order.total_cost, this.assetConfig.decimals);
    return {
      actual_quantity: fact.actual_quantity,
      fact_unit_price: fact.actual_unit_price,
      fact_cost: fact.fact_cost,
      diff_state: cmp === 0 ? 'equal' : cmp < 0 ? 'less' : 'more',
    };
  }

  /** Складской учёт после закрытия выдачи — best-effort, не роняет закрытие. */
  private async settleWarehouse(order: MarketplaceOrderDomainEntity, fact: MarketplaceIssuanceSagaFact): Promise<void> {
    try {
      if (isStockOrder(order)) {
        const { released, issued_arrival_cost } = await this.inventoryRepo.finalizeReservedIssue(order.coopname, order.id, fact.actual_quantity, order.price_per_unit);
        this.logger.log(`Выдача stock-order ${order.id}: выдано ${fact.actual_quantity}, возвращено в остаток ${released} ед.`);
        await this.submitMarkdownLoss(order, issued_arrival_cost, fact.fact_cost);
      } else {
        const detached = await this.inventoryRepo.detachRemainderToStock(order.coopname, order.id, fact.actual_quantity, order.price_per_unit);
        this.logger.log(`Выдача order ${order.id}: выдано ${fact.actual_quantity}, в обезличенный остаток КУ ушло ${detached} ед.`);
      }
    } catch (err) {
      this.logger.warn(`Выдача order ${order.id}: не удалось закрыть складские позиции (${this.errMessage(err)}); склад покажет их как остаток до ручной сверки.`);
    }
  }

  /** Уценка по заказу из остатка (chain `markdown`, o.mkt.loss) — best-effort, идемпотентно на цепи. */
  private async submitMarkdownLoss(order: MarketplaceOrderDomainEntity, issued_arrival_cost: string, fact_cost: string): Promise<void> {
    const delta = Number.parseFloat(issued_arrival_cost) - Number.parseFloat(fact_cost);
    const minStep = 10 ** -this.assetConfig.decimals;
    if (!Number.isFinite(delta) || delta < minStep) return;
    try {
      await this.chainPort.markdown({ coopname: order.coopname, order_hash: order.order_hash, amount: this.formatAsset(delta.toFixed(this.assetConfig.decimals)) });
    } catch (err) {
      this.logger.warn(`Stock-order ${order.id}: списание уценки не прошло (${this.errMessage(err)}); дослать вручную повторным markdown.`);
    }
  }

  private async assertRecipientVerified(ordererAccount: string): Promise<void> {
    const verification = await this.verificationPort.checkRequired(ordererAccount, MARKETPLACE_ISSUE_ACTION_CODE);
    if (!verification.passed) {
      throw new ConflictException('Выдача невозможна: получатель не прошёл верификацию личности. Сверьте паспорт пайщика, подтвердите его личность и повторите.');
    }
  }

  private async loadAvailableOnWarehouse(order: MarketplaceOrderDomainEntity): Promise<number> {
    const sums = isStockOrder(order)
      ? await this.inventoryRepo.sumReservedByOrders(order.coopname, [order.id])
      : await this.inventoryRepo.sumOnWarehouseByOrders(order.coopname, [order.id]);
    return sums.get(order.id) ?? 0;
  }

  private assertWithinWarehouse(order: MarketplaceOrderDomainEntity, requested: number, available: number): void {
    if (available <= 0) throw new ConflictException(`По заказу ${order.id} нет принятого на склад имущества — выдача недоступна до приёмки поставки.`);
    if (requested > available) throw new ConflictException(`Нельзя выдать больше, чем принято на склад: доступно ${available}, запрошено ${requested}.`);
  }

  private async loadOrder(coopname: string, order_id: string): Promise<MarketplaceOrderDomainEntity> {
    const order = await this.orderRepo.findById(order_id);
    if (!order || order.coopname !== coopname) throw new NotFoundException(`Заказ ${order_id} не найден.`);
    return order;
  }

  private async requireSaga(coopname: string, order_id: string): Promise<MarketplaceIssuanceSagaDomainEntity> {
    const saga = await this.sagaRepo.findActiveByOrderId(coopname, order_id);
    if (!saga) throw new ConflictException('Выдача по заказу не начата — оператор должен зафиксировать факт у стойки.');
    return saga;
  }

  private assertOrderer(order: MarketplaceOrderDomainEntity, member_account: string): void {
    if (order.orderer_account !== member_account) throw new ForbiddenException('Заказ принадлежит другому пайщику.');
  }

  /** Номер решения из инлайн-действия `soviet::newsubmitted` в трассе транзакции. */
  private decisionIdFromTrace(tx: unknown): string | null {
    try {
      const data = findInlineActionData<{ decision_id?: unknown }>(tx, 'newsubmitted', SovietContract.contractName.production);
      const id = data?.decision_id;
      return id !== undefined && id !== null && Number(id) > 0 ? String(id) : null;
    } catch {
      return null;
    }
  }

  private decisionIdFromProtocol(protocol: ISignedDocument | null): string | null {
    try {
      const raw = (protocol as any)?.meta;
      const meta = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const id = meta?.decision_id;
      return id !== undefined && id !== null ? String(id) : null;
    } catch {
      return null;
    }
  }

  private async waitForStage(saga_id: string, stages: MarketplaceIssuanceSagaStage[], timeoutMs: number): Promise<MarketplaceIssuanceSagaDomainEntity> {
    const deadline = Date.now() + timeoutMs;
    let last = await this.sagaRepo.findById(saga_id);
    while (last && !stages.includes(last.stage) && Date.now() < deadline) {
      await this.sleep(500);
      last = await this.sagaRepo.findById(saga_id);
    }
    if (!last) throw new NotFoundException('Сага выдачи не найдена.');
    return last;
  }

  private emitSagaUpdated(saga: MarketplaceIssuanceSagaDomainEntity): void {
    const event: MarketplaceIssuanceSagaUpdatedEvent = {
      coopname: saga.coopname,
      saga_id: saga.id,
      order_id: saga.order_id,
      order_hash: saga.order_hash,
      proposal_id: saga.proposal_id,
      member_account: saga.member_account,
      braname: saga.braname,
      stage: saga.stage,
      decision_mode: saga.decision_mode,
    };
    this.eventBus.emit(MARKETPLACE_ISSUANCE_SAGA_UPDATED_EVENT, event);
  }

  /** Крипто-проверка подписей: каждая подпись — валидная подпись своего signed_hash. */
  private verifyDocumentSignature(
    doc: { signatures: Array<{ signer: string; public_key: string; signature: string; signed_hash: string }> },
    expectedSigner: string
  ): void {
    const signatures = doc.signatures ?? [];
    if (!signatures.some((s) => s.signer === expectedSigner)) {
      throw new ForbiddenException(`Документ должен быть подписан учётной записью ${expectedSigner}.`);
    }
    for (const sig of signatures) {
      let ok = false;
      try {
        ok = Signature.from(sig.signature).verifyDigest(sig.signed_hash, PublicKey.from(sig.public_key));
      } catch {
        ok = false;
      }
      if (!ok) throw new ForbiddenException(`Подпись ${sig.signer} не прошла проверку.`);
    }
  }

  private extractTxHash(tx: unknown): string {
    const anyTx = tx as { transaction_id?: string; id?: string; resolved?: { transaction?: { id?: string } } } | undefined;
    const hash = anyTx?.transaction_id ?? anyTx?.id ?? anyTx?.resolved?.transaction?.id;
    if (!hash) throw new ConflictException('Не получен tx_hash от блокчейна — повторите действие.');
    return String(hash);
  }

  private formatAsset(amount: string | number): string {
    return `${Number.parseFloat(String(amount)).toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export const MARKETPLACE_ISSUANCE_SERVICE = Symbol('MARKETPLACE_ISSUANCE_SERVICE');
