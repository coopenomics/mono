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
import { createHash, randomUUID } from 'crypto';
import { Cooperative, type MarketContract } from 'cooptypes';
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import {
  LOGGER_PORT,
  type ILoggerPort,
  DOCUMENT_PORT,
  type IDocumentPort,
  type InnerGeneratedDocument,
  type InnerDocumentAggregate,
  SOVIET_ROBOT_PORT,
  type ISovietRobotPort,
} from '@coopenomics/innercoop';
import { toQuantityAsset } from '../shared/quantity.util';
import {
  calcCostAmount,
  minorToDecimalString,
  proRataByMoney,
  proRataByQuantity,
  sumMoney,
} from '../shared/cost.util';
import type { ISignedDocument } from '@coopenomics/innercoop';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MarketplaceInventoryOwnerships,
  MarketplaceInventoryStatuses,
} from '../../domain/entities/marketplace-inventory.types';
import {
  MARKETPLACE_RETURN_CLAIM_REPOSITORY,
  type MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import { marketplaceOrderUnitLabel } from '../shared/unit-label.util';
import { MarketplaceReturnClaimImagesService } from './marketplace-return-claim-images.service';
import type { MarketplaceReturnClaimDomainEntity } from '../../domain/entities/marketplace-return-claim.entity';
import {
  MarketplaceReturnClaimDefectCategories,
  MarketplaceReturnClaimExpectedResolutions,
  MarketplaceReturnClaimStatuses,
  type MarketplaceReturnClaimDecisionLogEntry,
  type MarketplaceReturnClaimDefectCategory,
  type MarketplaceReturnClaimOnSiteInspection,
  type MarketplaceReturnClaimPhoto,
  type MarketplaceReturnClaimStatus,
} from '../../domain/entities/marketplace-return-claim.types';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceShareContributionStatementSignedInputDTO } from '../documents-dto/marketplace-share-contribution-statement-document.dto';
import { SignedDigitalDocumentInputDTO, HttpApiError } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT,
  MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT,
  MARKETPLACE_RETURN_CLAIM_FINALIZED_EVENT,
  MARKETPLACE_RETURN_ACCEPTED_FOR_SUPPLIER_EVENT,
  MARKETPLACE_RETURN_COUNCIL_DECIDED_EVENT,
  type MarketplaceReturnCouncilDecidedEvent,
  type MarketplaceReturnClaimSubmittedEvent,
  type MarketplaceReturnClaimDecidedEvent,
  type MarketplaceReturnClaimFinalizedEvent,
  type MarketplaceReturnAcceptedForSupplierEvent,
} from '../events/marketplace-notification.events';

/**
 * Сырой файл фото, поступающий из mutation. UI кодирует содержимое в base64
 * (поскольку graphql-upload потоковая загрузка в desktop UI не используется,
 * фронт уже работает через base64-payload в input'е). Backend сам хеширует и
 * кладёт в bucket `stol-zakazov:images`.
 */
/** Сколько ждать робота решений совета у стойки, прежде чем отпустить мутацию в режим ожидания. */
const ROBOT_WAIT_MS = 12_000;
/** Сколько ждать материализации решения в цепи после accretrn (парсер и узел). */
const DECISION_LOOKUP_ATTEMPTS = 6;
const DECISION_LOOKUP_DELAY_MS = 700;

export interface MarketplaceReturnClaimImageUploadDTO {
  /** Содержимое файла в base64. */
  base64: string;
  /** MIME-тип — допускаются image/jpeg | image/png | image/webp. */
  mime_type: string;
}

export interface MarketplaceCreateReturnClaimInput {
  coopname: string;
  orderer_account: string;
  order_id: string;
  reason_text: string;
  defect_category: MarketplaceReturnClaimDefectCategory | null;
  /** Возвращаемое количество — по умолчанию = order.actual_quantity. */
  actual_quantity?: number;
  /** Подписанное заказчиком Заявление о внесении паевого взноса имуществом (registry_id=1116). */
  signed_statement: MarketplaceShareContributionStatementSignedInputDTO;
  /** Фотографии товара — обязательно мин. 1, макс. 10. */
  photos: MarketplaceReturnClaimImageUploadDTO[];
}

export interface MarketplaceApproveReturnVisitInput {
  coopname: string;
  chairman_account: string;
  braname: string;
  claim_id: string;
  /** Опционально: одобрение (в отличие от отказа) не обязано мотивироваться. */
  comment?: string;
}

export interface MarketplaceRejectReturnRemoteInput {
  coopname: string;
  chairman_account: string;
  braname: string;
  claim_id: string;
  comment: string;
}

export interface MarketplaceAcceptReturnAtVisitInput {
  coopname: string;
  chairman_account: string;
  braname: string;
  claim_id: string;
  inspection_result: string;
  scanned_barcode: string | null;
  inspection_photos?: MarketplaceReturnClaimImageUploadDTO[];
  /**
   * Заявление о внесении паевого взноса имуществом (registry 1116) со второй
   * подписью оператора — приём имущества оформляется со-подписью на том же
   * документе (канон двухподписных документов). Контракт требует обе
   * подписи и с ними ставит заявление на повестку совета.
   */
  signed_statement?: MarketplaceShareContributionStatementSignedInputDTO;
}

export interface MarketplaceHandBackReturnInput {
  coopname: string;
  operator_account: string;
  braname: string;
  claim_id: string;
}

export interface MarketplaceRejectReturnAtVisitInput {
  coopname: string;
  chairman_account: string;
  braname: string;
  claim_id: string;
  inspection_result: string;
  inspection_photos?: MarketplaceReturnClaimImageUploadDTO[];
}

export interface MarketplaceReturnClaimResult {
  claim: MarketplaceReturnClaimDomainEntity;
  tx_hash: string;
}

/**
 * Эпик 7 + компонент 68 (паевая модель): state machine гарантийного возврата
 * имущества пайщиком. Backend оркеструет процесс p.mkt.return (стандарт
 * `p.mkt.return.standard.yaml`); переходы проходят через действия контракта
 * `marketplace` и обратные вызовы совета:
 *
 *  - submretrn   — пайщик подаёт заявление 1116 (своя подпись); PENDING_CHAIRMAN_REVIEW
 *  - aprretrem   — оператор приглашает на участок; APPROVED_FOR_VISIT
 *  - rejretrem   — отказ удалённо; REJECTED_REMOTELY (final)
 *  - rejretrn    — оператор не стал принимать имущество; REJECTED_AT_VISIT (final)
 *  - accretrn    — оператор принял имущество (вторая подпись на 1116), контракт
 *                  инлайн ставит повестку совета `mktretrn`; PENDING_COUNCIL.
 *                  Движений по средствам нет.
 *  - onmktrtauth — совет «за»: контракт одной транзакцией откатывает все
 *                  движения по заказу (паевой + членский взнос обратно
 *                  пайщику); ACCEPTED_BY_COUNCIL (final), имущество — в остаток.
 *  - onmktrtdecl — совет «против» / срок повестки истёк; DECLINED_BY_COUNCIL
 *  - handback    — оператор выдал имущество обратно; HANDED_BACK (final)
 *
 * Робот решений совета зовётся напрямую через кросс-плагинный порт сразу
 * после приёма имущества: если совет настроил робота, решение приходит за
 * секунды и оператор видит его у стойки. Иначе (нет кворума, крупная сумма,
 * робот не настроен) заявление остаётся в спокойном ожидании сколь угодно
 * долго — пайщику ничего делать не нужно, о решении сообщит push. По
 * истечении срока ожидания (контракт: 7 дней) оператор может выдать
 * имущество обратно.
 *
 * Фотографии товара и очного осмотра лежат в bucket'е `stol-zakazov:images`
 * (через `MarketplaceReturnClaimImagesService`), on-chain публикуются их
 * sha256-хеши (`photos[]` параметра submretrn).
 *
 * Order остаётся в статусе RECEIVED — возврат фиксируется отдельной
 * сущностью; в UI orderer'а в карточке заказа появляется overlay по claim'у.
 */
@Injectable()
export class MarketplaceReturnClaimService {
  constructor(
    @Inject(MARKETPLACE_RETURN_CLAIM_REPOSITORY)
    private readonly claimRepo: MarketplaceReturnClaimDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    private readonly imagesService: MarketplaceReturnClaimImagesService,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    // Порт робота решений совета: до слияния ветки робота мост отдаёт null —
    // тогда любое решение ждём от людей.
    @Optional()
    @Inject(SOVIET_ROBOT_PORT)
    private readonly robotPort?: ISovietRobotPort | null
  ) {
    this.logger.setContext(MarketplaceReturnClaimService.name);
  }

  // ── Read-side queries ─────────────────────────────────────────────────

  async findById(coopname: string, id: string): Promise<MarketplaceReturnClaimDomainEntity> {
    const claim = await this.claimRepo.findById(id);
    if (!claim || claim.coopname !== coopname) {
      throw new NotFoundException(`Заявление на возврат ${id} не найдено.`);
    }
    return claim;
  }

  async listByOrderer(coopname: string, orderer_account: string) {
    return this.claimRepo.listByOrderer(coopname, orderer_account);
  }

  async listByDeliveryBraname(coopname: string, delivery_braname: string) {
    return this.claimRepo.listByDeliveryBraname(coopname, delivery_braname);
  }

  /**
   * Story 7.1: backend-генерируемый payload заявления (registry_id=1116,
   * `MarketplaceReturnStatement`). UI получает HTML preview + canonical hash
   * и подписывает приватным ключом пайщика, после чего отправляет в
   * `submitReturnClaim` вместе с фото.
   *
   * `request_hash` детерминирован: sha256('return:' + order_hash + ':' +
   * orderer + ':' + actual_quantity). Тот же hash используется как `hash`
   * генерируемого заявления и как `request_hash` параметра submretrn —
   * двусторонняя сверка backend ↔ on-chain.
   */
  async getReturnClaimSignablePayload(input: {
    coopname: string;
    orderer_account: string;
    order_id: string;
    actual_quantity?: number;
    reason_text?: string;
  }): Promise<InnerGeneratedDocument> {
    const order = await this.loadOrderForReturn(input.coopname, input.order_id, input.orderer_account);
    const quantity = this.resolveActualQuantity(order, input.actual_quantity);
    return this.generateStatementDocument({
      order,
      orderer: input.orderer_account,
      actual_quantity: quantity,
      reason_text: input.reason_text,
    });
  }

  /**
   * Агрегат для со-подписи оператора при приёме имущества: исходное заявление
   * пайщика (1116) с его подписью + тело документа для ознакомления. Фронт
   * накладывает вторую подпись (`signDocument(rawDocument, operator, 2,
   * [document])`) и отправляет в `acceptReturnAtVisit`. Ownership-проверка КУ —
   * на резолвере (как в АПП-приёмке).
   */
  async getChairmanReturnSignablePayload(
    coopname: string,
    claim_id: string
  ): Promise<InnerDocumentAggregate> {
    const claim = await this.findById(coopname, claim_id);
    if (claim.status !== MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT) {
      throw new ConflictException(
        `Заявление в статусе «${claim.status}»: со-подпись председателя доступна только после одобрения очного визита.`
      );
    }
    if (!claim.statement) {
      throw new ConflictException(
        `Заявление ${claim.id}: подписанное пайщиком заявление не сохранено — со-подпись невозможна.`
      );
    }
    const aggregate = await this.documentPort.buildAggregate(claim.statement);
    if (!aggregate) {
      throw new ConflictException(
        `Заявление ${claim.id}: тело документа по doc_hash ${claim.statement.doc_hash} не найдено в сторе.`
      );
    }
    return aggregate;
  }

  // ── Story 7.1: пайщик подаёт заявление ───────────────────────────────

  /**
   * Требования к заявлению, проверяемые до обращения к заказу и цепи: причина
   * своими словами и хотя бы одно фото. Вынесено из `submitReturnClaim` —
   * заявление рассматривают удалённо, и без описания с фотографиями оператору
   * пункта выдачи решать нечего.
   */
  private validateSubmitInput(input: MarketplaceCreateReturnClaimInput): void {
    if (!input.reason_text || input.reason_text.trim().length === 0) {
      throw new BadRequestException('Опишите причину возврата.');
    }
    if (input.reason_text.length > 2000) {
      throw new BadRequestException('Причина возврата не должна превышать 2000 символов.');
    }
    if (!Array.isArray(input.photos) || input.photos.length === 0) {
      throw new BadRequestException('Приложите хотя бы одну фотографию товара.');
    }
    if (input.photos.length > 10) {
      throw new BadRequestException('Можно приложить не более 10 фотографий.');
    }
    this.validatePhotoPayloads(input.photos);
  }

  async submitReturnClaim(
    input: MarketplaceCreateReturnClaimInput
  ): Promise<MarketplaceReturnClaimResult> {
    this.validateSubmitInput(input);

    const order = await this.loadOrderForReturn(input.coopname, input.order_id, input.orderer_account);
    const actual_quantity = this.resolveActualQuantity(order, input.actual_quantity);
    const existingActive = await this.claimRepo.findActiveByOrderId(input.coopname, order.id);
    if (existingActive) {
      throw new ConflictException(
        'По этому заказу уже открыто заявление на возврат.'
      );
    }

    this.verifySignatures(input.signed_statement);

    const claimId = randomUUID();
    const request_hash = this.computeRequestHash({
      order_hash: order.order_hash,
      orderer: input.orderer_account,
      actual_quantity,
    });

    const fact_cost = this.computeFactCost(order, actual_quantity);
    const fee_refund = this.computeFeeRefund(order, actual_quantity);

    // Сначала кладём фото в bucket, чтобы on-chain submit мог опереться
    // на их sha256-хеши.
    const photos = await this.uploadPhotos({
      files: input.photos,
      claimId,
      role: 'orderer',
      ownerAccount: input.orderer_account,
      orderId: order.id,
    });

    const statementAct = new SignedDigitalDocumentInputDTO(input.signed_statement).toDocument() as MarketContract.Actions.SubmRetrn.ISubmRetrn['statement'];

    let tx;
    try {
      tx = await this.chainPort.submRetrn({
        coopname: order.coopname,
        orderer: input.orderer_account,
        request_hash,
        original_order_hash: order.order_hash,
        actual_quantity: toQuantityAsset(actual_quantity, order.unit_of_measure),
        reason_text: input.reason_text,
        photos: photos.map((p) => p.content_hash),
        statement: statementAct,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Подача заявления на возврат order ${order.id}: on-chain submretrn упал (${message}); заявление не зарегистрировано, фото удалены из bucket.`
      );
      await this.cleanupBucketPhotos(photos);
      throw new ConflictException(
        `Подача заявления на возврат не выполнена: ${message}. Повторите попытку.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      await this.cleanupBucketPhotos(photos);
      throw new ConflictException(
        'Подача заявления на возврат: цепь не вернула tx_hash — заявление не зарегистрировано, попробуйте ещё раз.'
      );
    }
    const claim = await this.claimRepo.create({
      id: claimId,
      coopname: order.coopname,
      request_hash,
      order_id: order.id,
      order_hash: order.order_hash,
      orderer_account: input.orderer_account,
      delivery_braname: order.delivery_braname,
      supplier_account: order.supplier_account,
      reason_text: input.reason_text,
      defect_category: input.defect_category ?? null,
      expected_resolution: MarketplaceReturnClaimExpectedResolutions.FUNDS_RETURN,
      actual_quantity,
      fact_cost,
      fee_refund,
      photos,
      statement: input.signed_statement as ISignedDocument,
      submretrn_tx_hash: txHash,
      status: MarketplaceReturnClaimStatuses.PENDING_CHAIRMAN_REVIEW,
    });

    this.logger.log(
      `Заявление на возврат ${claim.id} зарегистрировано: order=${order.id}, photos=${photos.length}, fact_cost=${fact_cost} (tx=${txHash}).`
    );

    const event: MarketplaceReturnClaimSubmittedEvent = {
      coopname: claim.coopname,
      claim_id: claim.id,
      order_id: claim.order_id,
      orderer_account: claim.orderer_account,
      delivery_braname: claim.delivery_braname,
      reason_text: claim.reason_text,
    };
    this.eventBus.emit(MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT, event);

    return { claim, tx_hash: txHash };
  }

  // ── Story 7.2: председатель удалённо ─────────────────────────────────

  async approveReturnVisit(
    input: MarketplaceApproveReturnVisitInput
  ): Promise<MarketplaceReturnClaimResult> {
    if (input.comment && input.comment.length > 500) {
      throw new BadRequestException('Комментарий не может быть длиннее 500 символов.');
    }
    const claim = await this.findById(input.coopname, input.claim_id);
    if (claim.status !== MarketplaceReturnClaimStatuses.PENDING_CHAIRMAN_REVIEW) {
      throw new ConflictException(
        `Заявление в статусе «${claim.status}», удалённое одобрение недопустимо.`
      );
    }
    this.assertBranameMatchesClaim(claim, input.braname, 'удалённое одобрение');

    let tx;
    try {
      tx = await this.chainPort.aprRetRem({
        coopname: claim.coopname,
        signer: input.chairman_account,
        braname: input.braname,
        request_hash: claim.request_hash,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Одобрение возврата claim ${claim.id}: on-chain aprretrem упал (${message}); статус не меняется.`
      );
      throw new ConflictException(
        `Одобрение очного визита на цепи не выполнено: ${message}.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      throw new ConflictException(
        'Одобрение очного визита: цепь не вернула tx_hash — статус не меняем, попробуйте ещё раз.'
      );
    }
    const entry: MarketplaceReturnClaimDecisionLogEntry = {
      stage: 'remote',
      decision: 'approve_visit',
      by_chairman_account: input.chairman_account,
      braname: input.braname,
      comment: input.comment?.trim() ?? '',
      at: new Date(),
      tx_hash: txHash,
    };
    const updated = await this.claimRepo.applyDecision(claim.id, {
      status: MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT,
      decision_entry: entry,
    });

    this.logger.log(
      `Заявление на возврат ${claim.id}: председатель ${input.chairman_account} одобрил очный визит на КУ ${input.braname} (tx=${txHash}).`
    );

    this.emitDecided(updated, entry);
    return { claim: updated, tx_hash: txHash };
  }

  async rejectReturnRemote(
    input: MarketplaceRejectReturnRemoteInput
  ): Promise<MarketplaceReturnClaimResult> {
    this.requireComment(input.comment);
    const claim = await this.findById(input.coopname, input.claim_id);
    if (claim.status !== MarketplaceReturnClaimStatuses.PENDING_CHAIRMAN_REVIEW) {
      throw new ConflictException(
        `Заявление в статусе «${claim.status}», удалённый отказ недопустим.`
      );
    }
    this.assertBranameMatchesClaim(claim, input.braname, 'удалённый отказ');

    let tx;
    try {
      tx = await this.chainPort.rejRetRem({
        coopname: claim.coopname,
        signer: input.chairman_account,
        braname: input.braname,
        request_hash: claim.request_hash,
        reason: input.comment,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Отказ удалённо claim ${claim.id}: on-chain rejretrem упал (${message}); статус не меняется.`
      );
      throw new ConflictException(
        `Отказ удалённо на цепи не выполнен: ${message}.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      throw new ConflictException(
        'Отказ удалённо: цепь не вернула tx_hash — статус не меняем, попробуйте ещё раз.'
      );
    }
    const entry: MarketplaceReturnClaimDecisionLogEntry = {
      stage: 'remote',
      decision: 'reject_remote',
      by_chairman_account: input.chairman_account,
      braname: input.braname,
      comment: input.comment,
      at: new Date(),
      tx_hash: txHash,
    };
    const updated = await this.claimRepo.applyDecision(claim.id, {
      status: MarketplaceReturnClaimStatuses.REJECTED_REMOTELY,
      decision_entry: entry,
    });

    this.emitDecided(updated, entry);
    this.emitFinalized(updated, entry);
    return { claim: updated, tx_hash: txHash };
  }

  // ── У стойки: приём имущества → повестка совета ──────────────────────

  /**
   * Оператор принял имущество: вторая подпись на заявлении 1116 → `accretrn`
   * → контракт инлайн ставит повестку совета. Денег не двигаем. Дальше —
   * номер решения из цепи, прямой вызов робота и короткое ожидание у стойки;
   * если решение не пришло, заявление остаётся в PENDING_COUNCIL.
   */
  async acceptReturnAtVisit(
    input: MarketplaceAcceptReturnAtVisitInput
  ): Promise<MarketplaceReturnClaimResult> {
    this.requireInspectionResult(input.inspection_result);
    let claim = await this.findById(input.coopname, input.claim_id);
    // Идемпотентность: повтор после обрыва связи — доводим ожидание, не дублируем accretrn.
    if (claim.status === MarketplaceReturnClaimStatuses.PENDING_COUNCIL) {
      const settled = await this.settleAfterRobot(await this.attachCouncilDecision(claim));
      return { claim: settled, tx_hash: this.lastTxHash(settled) };
    }
    if (claim.status !== MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT) {
      throw new ConflictException(
        `Заявление в статусе «${claim.status}», приём имущества недопустим.`
      );
    }
    this.assertBranameMatchesClaim(claim, input.braname, 'приём имущества');

    if (!input.signed_statement) {
      throw new BadRequestException(
        'Для приёма имущества требуется заявление пайщика со второй подписью оператора.'
      );
    }
    const meta = input.signed_statement.meta as { registry_id?: number; order_hash?: string } | undefined;
    if (
      meta?.registry_id !== Cooperative.Registry.MarketplaceShareContributionStatement.registry_id ||
      (meta?.order_hash && meta.order_hash !== claim.order_hash)
    ) {
      throw new BadRequestException('Подписан не тот документ — обновите экран заявления.');
    }
    this.verifySignatures(input.signed_statement);
    const coSignedStatement = new SignedDigitalDocumentInputDTO(
      input.signed_statement
    ).toDocument() as MarketContract.Actions.AccRetrn.IAccRetrn['statement'];

    const inspectionPhotos = await this.uploadOptionalPhotos({
      files: input.inspection_photos,
      claimId: claim.id,
      role: 'on_site',
      ownerAccount: input.chairman_account,
      orderId: claim.order_id,
    });

    let tx;
    try {
      tx = await this.chainPort.accRetrn({
        coopname: claim.coopname,
        signer: input.chairman_account,
        braname: input.braname,
        request_hash: claim.request_hash,
        statement: coSignedStatement,
        // Бизнес-поля для протокола робот берёт из меты заявления повестки.
        meta: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Приём имущества claim ${claim.id}: on-chain accretrn упал (${message}); фото осмотра удалены из bucket.`
      );
      await this.cleanupBucketPhotos(inspectionPhotos);
      throw new ConflictException(`Приём имущества на цепи не выполнен: ${message}.`);
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      await this.cleanupBucketPhotos(inspectionPhotos);
      throw new ConflictException(
        'Приём имущества: цепь не вернула tx_hash — статус не меняем, попробуйте ещё раз.'
      );
    }
    const at = new Date();
    const entry: MarketplaceReturnClaimDecisionLogEntry = {
      stage: 'on_site',
      decision: 'accept_at_visit',
      by_chairman_account: input.chairman_account,
      braname: input.braname,
      comment: input.inspection_result,
      at,
      tx_hash: txHash,
    };
    const inspection: MarketplaceReturnClaimOnSiteInspection = {
      result_text: input.inspection_result,
      photos: inspectionPhotos,
      scanned_barcode: input.scanned_barcode ?? null,
      by_chairman_account: input.chairman_account,
      at,
    };
    const moved = await this.claimRepo.transition(claim.id, MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT, {
      status: MarketplaceReturnClaimStatuses.PENDING_COUNCIL,
      decision_entry: entry,
      on_site_inspection: inspection,
      statement: input.signed_statement as unknown as ISignedDocument,
      accepted_at: at,
    });
    claim = moved ?? (await this.findById(input.coopname, input.claim_id));

    this.logger.log(
      `Заявление на возврат ${claim.id}: имущество принято на КУ ${input.braname}, заявление на повестке совета (tx=${txHash}).`
    );
    this.emitDecided(claim, entry);

    claim = await this.attachCouncilDecision(claim);
    claim = await this.settleAfterRobot(claim);
    return { claim, tx_hash: txHash };
  }

  // ── Совет: номер решения, робот, ожидание ────────────────────────────

  /**
   * Номер решения совета по хэшу повестки (= request_hash) — с короткими
   * повторами: узел материализует строку в тот же блок, чтение через парсер
   * может отставать. Без номера остаёмся как есть — дочитает сторож.
   */
  async attachCouncilDecision(claim: MarketplaceReturnClaimDomainEntity): Promise<MarketplaceReturnClaimDomainEntity> {
    if (claim.status !== MarketplaceReturnClaimStatuses.PENDING_COUNCIL || claim.council_decision_id) return claim;
    for (let i = 0; i < DECISION_LOOKUP_ATTEMPTS; i++) {
      const decision = await this.chainPort.findCouncilDecisionByHash(claim.coopname, claim.request_hash).catch(() => null);
      if (decision) {
        return this.claimRepo.patchCouncil(claim.id, { council_decision_id: String(decision.id) });
      }
      await this.sleep(DECISION_LOOKUP_DELAY_MS);
    }
    this.logger.warn(`Заявление ${claim.id}: решение совета ещё не видно в цепи — дочитает сторож.`);
    return claim;
  }

  /**
   * Прямой рычаг робота: просим решить сейчас и ждём у стойки. Исход
   * доводится обратным вызовом контракта через парсер — ждём, пока слушатель
   * переведёт заявление из PENDING_COUNCIL. Иначе — спокойное ожидание.
   */
  private async settleAfterRobot(claim: MarketplaceReturnClaimDomainEntity): Promise<MarketplaceReturnClaimDomainEntity> {
    if (claim.status !== MarketplaceReturnClaimStatuses.PENDING_COUNCIL || !claim.council_decision_id) return claim;
    const mode = await this.requestRobot(claim);
    if (mode !== 'ROBOT') return (await this.claimRepo.findById(claim.id)) ?? claim;
    return this.waitForLeaving(claim.id, MarketplaceReturnClaimStatuses.PENDING_COUNCIL, ROBOT_WAIT_MS);
  }

  /** Вызов робота; возвращает режим принятия решения, записанный в заявление. */
  async requestRobot(claim: MarketplaceReturnClaimDomainEntity): Promise<'ROBOT' | 'MANUAL'> {
    if (!claim.council_decision_id) return claim.council_decision_mode ?? 'MANUAL';
    let mode: 'ROBOT' | 'MANUAL' = 'MANUAL';
    if (this.robotPort) {
      try {
        if (await this.robotPort.isEnabled()) {
          const result = await this.robotPort.requestDecision({
            coopname: claim.coopname,
            decision_id: Number(claim.council_decision_id),
            decision_type: 'mktretrn',
            decision_hash: claim.request_hash,
            username: claim.orderer_account,
          });
          mode = result.outcome === 'manual' ? 'MANUAL' : 'ROBOT';
          this.logger.log(`Заявление ${claim.id}: робот решений совета ответил «${result.outcome}»${result.detail ? ` (${result.detail})` : ''}.`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Заявление ${claim.id}: вызов робота решений совета не удался (${message}); ждём решение людей.`);
        mode = 'ROBOT';
      }
    }
    await this.claimRepo.patchCouncil(claim.id, { council_decision_mode: mode });
    return mode;
  }

  /**
   * `onmktrtauth`: совет «за», контракт уже откатил все движения по заказу.
   * Заявление → ACCEPTED_BY_COUNCIL, снапшот восстановленной суммы, имущество
   * — в обезличенный остаток участка; пайщику, стойке и поставщику — сигналы.
   */
  async onCouncilAuthorized(input: {
    coopname: string;
    request_hash: string;
    protocol: ISignedDocument | null;
    tx_hash: string;
  }): Promise<void> {
    const claim = await this.claimRepo.findByRequestHash(input.coopname, input.request_hash);
    if (!claim) {
      this.logger.warn(`onmktrtauth: заявление по request_hash ${input.request_hash} не найдено.`);
      return;
    }
    if (claim.status !== MarketplaceReturnClaimStatuses.PENDING_COUNCIL) return;
    const at = new Date();
    const total = sumMoney([claim.fact_cost, claim.fee_refund ?? '0'], this.assetConfig.decimals);
    const entry: MarketplaceReturnClaimDecisionLogEntry = {
      stage: 'council',
      decision: 'council_authorized',
      by_chairman_account: claim.coopname,
      braname: claim.delivery_braname,
      comment: 'Совет принял имущество как паевой взнос — все движения по заказу восстановлены.',
      at,
      tx_hash: input.tx_hash,
    };
    const moved = await this.claimRepo.transition(claim.id, MarketplaceReturnClaimStatuses.PENDING_COUNCIL, {
      status: MarketplaceReturnClaimStatuses.ACCEPTED_BY_COUNCIL,
      decision_entry: entry,
      ledger_snapshot: { amount: total, returned_quantity: claim.actual_quantity, tx_hash: input.tx_hash, at },
      council_protocol: input.protocol,
    });
    if (!moved) return;
    const decisionId = this.decisionIdFromProtocol(input.protocol);
    if (decisionId && !moved.council_decision_id) {
      await this.claimRepo.patchCouncil(moved.id, { council_decision_id: decisionId });
    }
    this.logger.log(`Заявление на возврат ${claim.id}: совет «за», восстановлено ${total} (tx=${input.tx_hash}).`);

    const operator = claim.on_site_inspection?.by_chairman_account ?? claim.coopname;
    await this.restockReturnedItem(moved, claim.delivery_braname, operator, at);

    this.emitDecided(moved, entry);
    this.emitFinalized(moved, entry);
    this.emitCouncilDecided(moved, true);
    this.emitReturnAcceptedForSupplier(moved, claim.on_site_inspection?.result_text ?? claim.reason_text);
  }

  /**
   * `onmktrtdecl`: совет «против» либо срок повестки истёк. Имущество ждёт
   * пайщика на участке; баланс не меняется. Заявление → DECLINED_BY_COUNCIL.
   */
  async onCouncilDeclined(input: { coopname: string; request_hash: string; reason: string; tx_hash: string }): Promise<void> {
    const claim = await this.claimRepo.findByRequestHash(input.coopname, input.request_hash);
    if (!claim) {
      this.logger.warn(`onmktrtdecl: заявление по request_hash ${input.request_hash} не найдено.`);
      return;
    }
    if (claim.status !== MarketplaceReturnClaimStatuses.PENDING_COUNCIL) return;
    const entry: MarketplaceReturnClaimDecisionLogEntry = {
      stage: 'council',
      decision: 'council_declined',
      by_chairman_account: claim.coopname,
      braname: claim.delivery_braname,
      comment: input.reason,
      at: new Date(),
      tx_hash: input.tx_hash,
    };
    const moved = await this.claimRepo.transition(claim.id, MarketplaceReturnClaimStatuses.PENDING_COUNCIL, {
      status: MarketplaceReturnClaimStatuses.DECLINED_BY_COUNCIL,
      decision_entry: entry,
    });
    if (!moved) return;
    this.logger.log(`Заявление на возврат ${claim.id}: совет отказал (${input.reason}) — имущество ждёт пайщика на участке.`);
    this.emitDecided(moved, entry);
    this.emitCouncilDecided(moved, false);
  }

  /**
   * Оператор выдал имущество обратно: после отказа совета либо по истечении
   * срока ожидания решения (контракт проверяет срок сам). Записи в цепи не
   * остаётся, заказ остаётся выданным. HANDED_BACK (final).
   */
  async handBackReturn(input: MarketplaceHandBackReturnInput): Promise<MarketplaceReturnClaimResult> {
    const claim = await this.findById(input.coopname, input.claim_id);
    if (
      claim.status !== MarketplaceReturnClaimStatuses.DECLINED_BY_COUNCIL &&
      claim.status !== MarketplaceReturnClaimStatuses.PENDING_COUNCIL
    ) {
      throw new ConflictException(`Заявление в статусе «${claim.status}» — выдавать имущество обратно нечего.`);
    }
    this.assertBranameMatchesClaim(claim, input.braname, 'выдача имущества обратно');
    let tx;
    try {
      tx = await this.chainPort.handBack({
        coopname: claim.coopname,
        signer: input.operator_account,
        braname: input.braname,
        request_hash: claim.request_hash,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ConflictException(`Выдача имущества обратно не выполнена: ${message}.`);
    }
    const txHash = this.extractTxHash(tx);
    const entry: MarketplaceReturnClaimDecisionLogEntry = {
      stage: 'on_site',
      decision: 'hand_back',
      by_chairman_account: input.operator_account,
      braname: input.braname,
      comment:
        claim.status === MarketplaceReturnClaimStatuses.DECLINED_BY_COUNCIL
          ? 'Имущество выдано пайщику обратно после отказа совета.'
          : 'Имущество выдано пайщику обратно: совет не принял решение в срок.',
      at: new Date(),
      tx_hash: txHash,
    };
    const updated = await this.claimRepo.applyDecision(claim.id, {
      status: MarketplaceReturnClaimStatuses.HANDED_BACK,
      decision_entry: entry,
    });
    this.logger.log(`Заявление на возврат ${claim.id}: имущество выдано обратно оператором ${input.operator_account} (tx=${txHash}).`);
    this.emitDecided(updated, entry);
    this.emitFinalized(updated, entry);
    return { claim: updated, tx_hash: txHash };
  }

  /**
   * Сторож: заявления на повестке совета без номера решения — дочитать
   * номер и позвать робота; с номером, но без режима — позвать робота.
   * Решение людей может идти сколь угодно долго: сторож ничего не торопит.
   */
  async watchdogTick(coopname: string, limit = 20): Promise<void> {
    const pending = await this.claimRepo.listByStatus(coopname, MarketplaceReturnClaimStatuses.PENDING_COUNCIL, limit);
    for (const claim of pending) {
      try {
        let current = claim;
        if (!current.council_decision_id) {
          const decision = await this.chainPort.findCouncilDecisionByHash(current.coopname, current.request_hash).catch(() => null);
          if (!decision) continue;
          current = await this.claimRepo.patchCouncil(current.id, { council_decision_id: String(decision.id) });
        }
        if (!current.council_decision_mode) {
          await this.requestRobot(current);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Сторож возврата: заявление ${claim.id} — ${message}`);
      }
    }
  }

  async rejectReturnAtVisit(
    input: MarketplaceRejectReturnAtVisitInput
  ): Promise<MarketplaceReturnClaimResult> {
    this.requireInspectionResult(input.inspection_result);
    const claim = await this.findById(input.coopname, input.claim_id);
    if (claim.status !== MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT) {
      throw new ConflictException(
        `Заявление в статусе «${claim.status}», отказ на месте недопустим.`
      );
    }
    this.assertBranameMatchesClaim(claim, input.braname, 'отказ на месте');

    const inspectionPhotos = await this.uploadOptionalPhotos({
      files: input.inspection_photos,
      claimId: claim.id,
      role: 'on_site',
      ownerAccount: input.chairman_account,
      orderId: claim.order_id,
    });

    let tx;
    try {
      tx = await this.chainPort.rejRetrn({
        coopname: claim.coopname,
        signer: input.chairman_account,
        braname: input.braname,
        request_hash: claim.request_hash,
        reason: input.inspection_result,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Отказ на месте claim ${claim.id}: on-chain rejretrn упал (${message}); статус не меняется, фото осмотра удалены из bucket.`
      );
      await this.cleanupBucketPhotos(inspectionPhotos);
      throw new ConflictException(
        `Отказ на цепи не выполнен: ${message}.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      await this.cleanupBucketPhotos(inspectionPhotos);
      throw new ConflictException(
        'Отказ на месте: цепь не вернула tx_hash — статус не меняем, попробуйте ещё раз.'
      );
    }
    const at = new Date();
    const entry: MarketplaceReturnClaimDecisionLogEntry = {
      stage: 'on_site',
      decision: 'reject_at_visit',
      by_chairman_account: input.chairman_account,
      braname: input.braname,
      comment: input.inspection_result,
      at,
      tx_hash: txHash,
    };
    const inspection: MarketplaceReturnClaimOnSiteInspection = {
      result_text: input.inspection_result,
      photos: inspectionPhotos,
      scanned_barcode: null,
      by_chairman_account: input.chairman_account,
      at,
    };
    const updated = await this.claimRepo.applyDecision(claim.id, {
      status: MarketplaceReturnClaimStatuses.REJECTED_AT_VISIT,
      decision_entry: entry,
      on_site_inspection: inspection,
    });

    this.emitDecided(updated, entry);
    this.emitFinalized(updated, entry);
    return { claim: updated, tx_hash: txHash };
  }

  // ── Image upload helper for resolver ─────────────────────────────────

  async getPhotoReadUrl(bucketKey: string): Promise<string> {
    return this.imagesService.getReadUrl(bucketKey);
  }

  // ── private helpers ──────────────────────────────────────────────────

  private async loadOrderForReturn(
    coopname: string,
    order_id: string,
    orderer_account: string
  ): Promise<MarketplaceOrderDomainEntity> {
    const order = await this.orderRepo.findById(order_id);
    if (!order || order.coopname !== coopname) {
      throw new NotFoundException(`Заказ ${order_id} не найден.`);
    }
    if (order.orderer_account !== orderer_account) {
      throw new ForbiddenException('Подавать заявление на возврат может только заказчик-владелец заказа.');
    }
    if (order.status !== 'RECEIVED') {
      throw new ConflictException(
        `Возврат возможен только по выданному заказу (текущий статус «${order.status}»).`
      );
    }
    if (order.warranty_until === null) {
      throw new ConflictException(
        'По этому заказу гарантия не предусмотрена — возврат невозможен.'
      );
    }
    if (order.warranty_until.getTime() <= Date.now()) {
      throw new ConflictException(
        `Гарантийный срок истёк ${order.warranty_until.toISOString().slice(0, 10)}.`
      );
    }
    return order;
  }

  private assertBranameMatchesClaim(
    claim: MarketplaceReturnClaimDomainEntity,
    braname: string,
    actionLabel: string
  ): void {
    if (!braname || braname.trim().length === 0) {
      throw new BadRequestException(`Не указан кооперативный участок для действия «${actionLabel}».`);
    }
    if (claim.delivery_braname !== braname) {
      throw new ForbiddenException(
        `Заявление привязано к кооперативному участку «${claim.delivery_braname}»; действие «${actionLabel}» от участка «${braname}» недопустимо.`
      );
    }
  }

  private async cleanupBucketPhotos(photos: MarketplaceReturnClaimPhoto[]): Promise<void> {
    if (!photos || photos.length === 0) return;
    for (const photo of photos) {
      try {
        await this.imagesService.deletePhoto(photo.bucket_key);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Cleanup фото возврата ${photo.bucket_key} не выполнен (${message}); orphaned-объект остаётся в bucket.`
        );
      }
    }
  }

  private validatePhotoPayloads(files: MarketplaceReturnClaimImageUploadDTO[]): void {
    const MAX_BYTES = 10 * 1024 * 1024;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f || typeof f.base64 !== 'string' || f.base64.length === 0) {
        throw new BadRequestException(`Фото #${i + 1}: пустое содержимое.`);
      }
      const approxBytes = Math.floor((f.base64.length * 3) / 4);
      if (approxBytes > MAX_BYTES) {
        throw new BadRequestException(
          `Фото #${i + 1}: размер ${(approxBytes / 1024 / 1024).toFixed(1)} МБ превышает лимит 10 МБ.`
        );
      }
    }
  }

  private resolveActualQuantity(order: MarketplaceOrderDomainEntity, requested?: number): number {
    const factQty = order.issuance_fact?.actual_quantity ?? order.quantity;
    if (requested === undefined || requested === null) return factQty;
    if (requested <= 0) {
      throw new BadRequestException('Возвращаемое количество должно быть больше нуля.');
    }
    if (requested > factQty) {
      throw new BadRequestException(
        `Нельзя вернуть больше единиц, чем было выдано (выдано ${factQty}).`
      );
    }
    return requested;
  }

  /**
   * Эффективная цена за базовую единицу (кг/л/шт), выведенная из фактической
   * выдачи (issuedCost/issuedQty), а не из `order.price_per_unit` напрямую:
   * при отпуске упаковкой (Эпик 18) `price_per_unit` — цена ЗА УПАКОВКУ, а
   * `actual_quantity` возврата — всегда в базовых единицах, так что прямое
   * произведение было бы неверным для packaged-офферов (review 2026-07-27 —
   * заявление показывало заведомо несвязанные «стоимость единицы»/«сумма
   * возврата»). Показывается в заявлении; сумма возврата считается не через
   * неё, а пропорцией от фактической суммы выдачи (см. computeFactCost).
   */
  private effectiveUnitCost(order: MarketplaceOrderDomainEntity): number {
    const issuedQty = order.issuance_fact?.actual_quantity ?? order.quantity;
    const issuedCost = Number.parseFloat(order.issuance_fact?.fact_cost ?? order.total_cost);
    if (!(issuedQty > 0)) return Number.parseFloat(order.price_per_unit);
    return issuedCost / issuedQty;
  }

  /**
   * Стоимость возвращаемого имущества — доля фактической суммы выдачи,
   * пропорциональная возвращаемому количеству. Зеркало контракта (submretrn
   * через `Marketplace::pro_rata`): деление от уже сложившейся суммы, а не
   * пересчёт от цены — так возврат совпадает с уплаченным до копейки, включая
   * случай, когда оператор скорректировал цену на выдаче.
   */
  private computeFactCost(order: MarketplaceOrderDomainEntity, actual_quantity: number): string {
    const decimals = this.assetConfig.decimals;
    const issuedQty = order.issuance_fact?.actual_quantity ?? order.quantity;
    const issuedCost = order.issuance_fact?.fact_cost ?? order.total_cost;
    if (!(issuedQty > 0)) {
      return calcCostAmount({
        quantity: actual_quantity,
        unit: order.unit_of_measure,
        unitPrice: order.price_per_unit,
        packageSize: order.package_size,
        decimals,
      });
    }
    return proRataByQuantity({
      total: issuedCost,
      part: actual_quantity,
      whole: issuedQty,
      unit: order.unit_of_measure,
      decimals,
    });
  }

  /**
   * Доля членского взноса, возвращаемая вместе с имуществом. Зеркало формулы
   * контракта (submretrn): взнос, фактически принятый кооперативом на выдаче,
   * масштабированный по доле возвращаемого количества. При возврате всего
   * выданного количества возвращается принятый взнос целиком — пайщик получает
   * обратно ровно ту сумму, которую заплатил за заказ.
   *
   * Значение здесь — read-model для UI и документа заявления; фактическое
   * движение средств делает контракт своей копией расчёта.
   */
  private computeFeeRefund(order: MarketplaceOrderDomainEntity, actual_quantity: number): string {
    const decimals = this.assetConfig.decimals;
    const lockedFee = order.membership_fee ?? '0';
    const totalCost = order.total_cost;
    const issuedQty = order.issuance_fact?.actual_quantity ?? 0;
    const issuedCost = order.issuance_fact?.fact_cost ?? '0';
    if (
      !(Number.parseFloat(lockedFee) > 0) ||
      !(Number.parseFloat(totalCost) > 0) ||
      !(issuedQty > 0)
    ) {
      return minorToDecimalString(0n, decimals);
    }

    // Взнос, принятый кооперативом на выдаче, — той же пропорцией, что применил
    // контракт в signiss2; затем доля возвращаемого количества.
    const acceptedFee = proRataByMoney({
      total: lockedFee,
      part: issuedCost,
      whole: totalCost,
      decimals,
    });
    return proRataByQuantity({
      total: acceptedFee,
      part: actual_quantity,
      whole: issuedQty,
      unit: order.unit_of_measure,
      decimals,
    });
  }

  private computeRequestHash(input: {
    order_hash: string;
    orderer: string;
    actual_quantity: number;
  }): string {
    const seed = `return:${input.order_hash}:${input.orderer}:${input.actual_quantity}`;
    return createHash('sha256').update(seed).digest('hex');
  }

  private async generateStatementDocument(input: {
    order: MarketplaceOrderDomainEntity;
    orderer: string;
    actual_quantity: number;
    reason_text?: string;
  }): Promise<InnerGeneratedDocument> {
    const fact_cost = this.computeFactCost(input.order, input.actual_quantity);
    // Артикул/наименование/единица/цена — из заказа и его оферты, не из
    // заглушки фабрики (см. review 2026-07-27: заглушка возвращала одни и те
    // же тестовые данные независимо от order_id).
    const offer = await this.offerRepo.findById(input.order.offer_id);
    // Категория дефекта в MVP не собирается формой (см. Story 7.1) и в
    // документ не попадает — на заявке (claim.defect_category) поле
    // остаётся про запас на будущее, но в тело подписываемого документа
    // не прокидывается вообще (не как null, не как пропущенный ключ):
    // отсутствующее необязательное поле в meta ловило рассинхрон между
    // GraphQL/JSON-транспортом клиенту (роняет undefined-ключи) и MongoDB
    // (материализует их в null) — client-side canonicalize(meta) давал
    // разные meta_hash при подписи и при повторном чтении для со-подписи
    // председателя («Хэш метаданных не совпадает», см. review 2026-07-27).
    const action: Cooperative.Registry.MarketplaceShareContributionStatement.Action = {
      registry_id: Cooperative.Registry.MarketplaceShareContributionStatement.registry_id,
      coopname: input.order.coopname,
      username: input.orderer,
      order_id: input.order.id,
      order_hash: input.order.order_hash,
      braname: input.order.delivery_braname,
      reason_text: input.reason_text ?? '',
      actual_quantity: input.actual_quantity,
      fact_cost,
      sku: input.order.offer_id,
      product_title: offer?.product_name ?? 'Товар по предложению',
      unit_of_measurement: marketplaceOrderUnitLabel(input.order.unit_of_measure),
      unit_cost: this.effectiveUnitCost(input.order).toFixed(4),
      currency: this.assetConfig.symbol,
      // Тело документа сохраняется в стор: оператору при со-подписи на
      // приёме имущества нужен ИСХОДНЫЙ документ (тот же порядок/состав ключей
      // meta) по doc_hash через buildDocumentAggregate — как и в АПП-приёмке.
      skip_save: false,
    };
    return this.documentPort.generate({ data: action });
  }

  private async uploadPhotos(input: {
    files: MarketplaceReturnClaimImageUploadDTO[];
    claimId: string;
    role: 'orderer' | 'on_site';
    ownerAccount: string;
    orderId: string;
  }): Promise<MarketplaceReturnClaimPhoto[]> {
    const out: MarketplaceReturnClaimPhoto[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const f = input.files[i];
      const bytes = Buffer.from(f.base64, 'base64');
      const photo = await this.imagesService.putPhoto({
        bytes,
        contentType: f.mime_type,
        claimId: input.claimId,
        role: input.role,
        ownerAccount: input.ownerAccount,
        orderId: input.orderId,
        index: i,
      });
      out.push(photo);
    }
    return out;
  }

  private async uploadOptionalPhotos(input: {
    files?: MarketplaceReturnClaimImageUploadDTO[];
    claimId: string;
    role: 'orderer' | 'on_site';
    ownerAccount: string;
    orderId: string;
  }): Promise<MarketplaceReturnClaimPhoto[]> {
    if (!input.files || input.files.length === 0) return [];
    if (input.files.length > 10) {
      throw new BadRequestException('Можно приложить не более 10 фотографий очного осмотра.');
    }
    this.validatePhotoPayloads(input.files);
    return this.uploadPhotos({
      files: input.files,
      claimId: input.claimId,
      role: input.role,
      ownerAccount: input.ownerAccount,
      orderId: input.orderId,
    });
  }

  private verifySignatures(document: ISignedDocument): void {
    if (!document.signatures || document.signatures.length === 0) {
      throw new HttpApiError(http.BAD_REQUEST, 'Документ не подписан: signatures пуст.');
    }
    for (const sig of document.signatures) {
      const publicKey = PublicKey.from(sig.public_key);
      const signature = Signature.from(sig.signature);
      const verified = signature.verifyDigest(sig.signed_hash, publicKey);
      if (!verified) {
        throw new HttpApiError(http.BAD_REQUEST, 'Недействительная подпись документа возврата.');
      }
    }
  }

  private extractTxHash(tx: unknown): string {
    const candidate = tx as
      | {
          response?: { transaction_id?: string };
          resolved?: { transaction?: { id?: string } };
          transaction?: { id?: string };
        }
      | undefined;
    return (
      candidate?.response?.transaction_id ??
      candidate?.resolved?.transaction?.id ??
      candidate?.transaction?.id ??
      ''
    );
  }

  private requireComment(comment: string): void {
    if (!comment || comment.trim().length === 0) {
      throw new BadRequestException('Укажите комментарий к решению.');
    }
    if (comment.length > 500) {
      throw new BadRequestException('Комментарий не должен превышать 500 символов.');
    }
  }

  private requireInspectionResult(result: string): void {
    if (!result || result.trim().length === 0) {
      throw new BadRequestException('Укажите результат очного осмотра.');
    }
    if (result.length > 2000) {
      throw new BadRequestException('Результат осмотра не должен превышать 2000 символов.');
    }
  }

  private emitDecided(
    claim: MarketplaceReturnClaimDomainEntity,
    entry: MarketplaceReturnClaimDecisionLogEntry
  ): void {
    const event: MarketplaceReturnClaimDecidedEvent = {
      coopname: claim.coopname,
      claim_id: claim.id,
      orderer_account: claim.orderer_account,
      stage: entry.stage,
      decision: entry.decision,
      comment: entry.comment,
      braname: entry.braname,
    };
    this.eventBus.emit(MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT, event);
  }

  private emitFinalized(
    claim: MarketplaceReturnClaimDomainEntity,
    entry: MarketplaceReturnClaimDecisionLogEntry
  ): void {
    const event: MarketplaceReturnClaimFinalizedEvent = {
      coopname: claim.coopname,
      claim_id: claim.id,
      orderer_account: claim.orderer_account,
      final_status: claim.status,
      decision: entry.decision,
      comment: entry.comment,
      ledger_snapshot: claim.ledger_snapshot,
    };
    this.eventBus.emit(MARKETPLACE_RETURN_CLAIM_FINALIZED_EVENT, event);
  }

  private emitCouncilDecided(claim: MarketplaceReturnClaimDomainEntity, authorized: boolean): void {
    const event: MarketplaceReturnCouncilDecidedEvent = {
      coopname: claim.coopname,
      claim_id: claim.id,
      order_id: claim.order_id,
      orderer_account: claim.orderer_account,
      delivery_braname: claim.delivery_braname,
      authorized,
    };
    this.eventBus.emit(MARKETPLACE_RETURN_COUNCIL_DECIDED_EVENT, event);
  }

  /** Ждём, пока слушатель обратных вызовов уведёт заявление из `status`; по таймауту — как есть. */
  private async waitForLeaving(
    claim_id: string,
    status: MarketplaceReturnClaimStatus,
    timeoutMs: number
  ): Promise<MarketplaceReturnClaimDomainEntity> {
    const deadline = Date.now() + timeoutMs;
    let last = await this.claimRepo.findById(claim_id);
    while (last && last.status === status && Date.now() < deadline) {
      await this.sleep(500);
      last = await this.claimRepo.findById(claim_id);
    }
    if (!last) throw new NotFoundException('Заявление на возврат не найдено.');
    return last;
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

  private lastTxHash(claim: MarketplaceReturnClaimDomainEntity): string {
    return claim.decision_log[claim.decision_log.length - 1]?.tx_hash ?? claim.submretrn_tx_hash;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitReturnAcceptedForSupplier(
    claim: MarketplaceReturnClaimDomainEntity,
    inspectionResult: string
  ): void {
    const event: MarketplaceReturnAcceptedForSupplierEvent = {
      coopname: claim.coopname,
      claim_id: claim.id,
      order_id: claim.order_id,
      supplier_account: claim.supplier_account,
      braname: claim.delivery_braname,
      inspection_result: inspectionResult,
    };
    this.eventBus.emit(MARKETPLACE_RETURN_ACCEPTED_FOR_SUPPLIER_EVENT, event);
  }

  /**
   * Возвращённое по гарантии имущество зачисляется отдельной позицией
   * обезличенного остатка кооператива (ownership=COOP, неопубликованная,
   * `RECEIVED`) — той же самой таблицы, что и «осталось после недовыдач и
   * отказов» (requirement 76): председатель либо публикует её заново
   * (`marketplacePublishStock`), либо ничего не делает — по истечении срока
   * годности позиция подсвечивается кандидатом на списание (`is_expired`,
   * тот же механизм, что и у обычного остатка), либо списывает вручную сразу
   * как брак.
   *
   * Срок годности/цену прибытия берём с ИСХОДНОЙ позиции склада этого заказа
   * (если она сохранилась — приёмка не удаляет строки, только меняет статус
   * ISSUED), а не пересчитываем заново от `shelf_life_days` оффера: срок
   * годности партии не «продлевается» тем, что она съездила к пайщику и
   * вернулась.
   *
   * Best-effort: сбой здесь не должен откатывать уже проведённый на цепи
   * откат движений по решению совета — деньги пайщику важнее бухгалтерии остатка,
   * которую при сбое видно в логе и можно поправить вручную.
   */
  /**
   * Характеристики возвращаемой позиции: цена прихода, срок годности и партия
   * поставки.
   *
   * Обычный заказ — исходная позиция несёт этот order_id напрямую; заказ из
   * остатка (stockorder) резервирует уже существующие COOP-позиции через
   * reserved_order_id (order_id на них не переносится, см. reserveStock /
   * finalizeReservedIssue) — пробуем оба пути.
   *
   * Партия берётся та же, которой имущество пришло на участок: колонка хранит
   * uuid поставки, и составной маркер вида `return:<id>` в неё физически не
   * влезает — вставка падала на типе, а ошибка гасилась в catch вызывающего.
   * Наружу это выглядело как принятый возврат без имущества на складе: деньги
   * пайщику вернулись, а остаток кооператива не появлялся, и списывать было
   * нечего. Поэтому нет партии → `null`, и вызывающий не пишет позицию вовсе.
   */
  private async resolveRestockOrigin(
    claim: MarketplaceReturnClaimDomainEntity,
    order: MarketplaceOrderDomainEntity,
    offer: { shelf_life_days?: number | null } | null,
    at: Date
  ): Promise<{ arrival_price: string; expiry_date: Date | null; shipment_id: string } | null> {
    const [byOrderId, byReservedOrderId] = await Promise.all([
      this.inventoryRepo.list({ coopname: claim.coopname, order_id: claim.order_id }),
      this.inventoryRepo.list({ coopname: claim.coopname, reserved_order_id: claim.order_id }),
    ]);
    const origin = byOrderId[0] ?? byReservedOrderId[0] ?? null;

    const shipment_id = origin?.shipment_id ?? order.shipment_id;
    if (!shipment_id) return null;

    const shelfLifeExpiry = offer?.shelf_life_days
      ? new Date(at.getTime() + offer.shelf_life_days * 86_400_000)
      : null;

    return {
      arrival_price: origin?.arrival_price ?? order.price_per_unit,
      expiry_date: origin?.expiry_date ?? shelfLifeExpiry,
      shipment_id,
    };
  }

  private async restockReturnedItem(
    claim: MarketplaceReturnClaimDomainEntity,
    braname: string,
    chairman_account: string,
    at: Date
  ): Promise<void> {
    try {
      const order = await this.orderRepo.findById(claim.order_id);
      if (!order) {
        this.logger.warn(
          `restockReturnedItem: заказ ${claim.order_id} не найден — возврат claim ${claim.id} не зачислен в остаток.`
        );
        return;
      }
      const offer = await this.offerRepo.findById(order.offer_id);
      const origin = await this.resolveRestockOrigin(claim, order, offer, at);
      if (!origin) {
        this.logger.warn(
          `restockReturnedItem: у заказа ${claim.order_id} нет партии поставки — возврат claim ${claim.id} не зачислен в остаток.`
        );
        return;
      }
      const { arrival_price, expiry_date, shipment_id } = origin;

      await this.inventoryRepo.create({
        coopname: claim.coopname,
        order_id: claim.order_id,
        shipment_id,
        braname,
        status: MarketplaceInventoryStatuses.RECEIVED,
        product_name_snapshot: offer?.product_name ?? 'Возвращённый товар',
        quantity_per_label: claim.actual_quantity,
        orderer_account_snapshot: claim.orderer_account,
        received_at: at,
        received_by_operator_account: chairman_account,
        expiry_date,
        ownership: MarketplaceInventoryOwnerships.COOP,
        arrival_price,
      });

      this.logger.log(
        `Заявление на возврат ${claim.id}: имущество (${claim.actual_quantity} ед.) зачислено в остаток кооператива КУ ${braname}.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `restockReturnedItem: не удалось зачислить возврат claim ${claim.id} в остаток (${message}) — сверить остаток вручную.`
      );
    }
  }
}

export const MARKETPLACE_RETURN_CLAIM_SERVICE = Symbol('MARKETPLACE_RETURN_CLAIM_SERVICE');

// Ссылка на канонический справочник категорий — для GraphQL enum.
export const MARKETPLACE_RETURN_CLAIM_DEFECT_CATEGORIES = MarketplaceReturnClaimDefectCategories;
