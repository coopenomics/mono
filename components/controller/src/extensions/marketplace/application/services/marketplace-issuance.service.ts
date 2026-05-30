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
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { HttpApiError } from '~/utils/httpApiError';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { MarketplaceIssueActSignedDocumentInputDTO } from '~/application/document/documents-dto/marketplace-issue-act-document.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderIssuanceFactSnapshot } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
  type MarketplaceOrderReadyToReceiveEvent,
} from '../events/marketplace-notification.events';

export interface MarketplaceOpenIssuanceInput {
  coopname: string;
  chairman_account: string;
  order_id: string;
  actual_quantity: number;
  signed_document: MarketplaceIssueActSignedDocumentInputDTO;
}

export interface MarketplaceFinalizeIssuanceInput {
  coopname: string;
  orderer_account: string;
  order_id: string;
  signed_document: MarketplaceIssueActSignedDocumentInputDTO;
}

export interface MarketplaceIssuanceResult {
  order: MarketplaceOrderDomainEntity;
  tx_hash: string;
}

/**
 * Story 6.1 / 6.3 (Эпик 6, FR21-FR25): state machine выдачи имущества
 * пайщику на ПВЗ с двойной подписью АПП-выдачи и тремя ветками сверки
 * фактического количества с заказом.
 *
 * Flow:
 *
 *  1. `openIssuance(order_id, actual_quantity, chairman_signed_document)` —
 *     оператор КУ сверяет привезённое имущество с заказом и фиксирует
 *     фактическое количество (`actual_quantity`) прямо при открытии выдачи;
 *     председатель КУ подписывает акт с этим количеством. Backend верифицирует
 *     подпись, сохраняет снапшот фактической выдачи (`issuance_fact`),
 *     отправляет on-chain `signiss1`, переводит Order
 *     ACCEPTED_TO_COOP → READY_TO_RECEIVE и эмитит push заказчику
 *     `marketplace-order-ready` (FR22).
 *
 *  2. `finalizeIssuance(order_id, signed_document)` — заказчик закрывает
 *     выдачу финальной подписью в своём кабинете на своём устройстве: он
 *     лишь подтверждает уже сформированный акт, факт не редактирует.
 *     `actual_quantity` и `delivery_signer` backend берёт из заказа
 *     (зафиксированы оператором при открытии). Backend верифицирует обе
 *     подписи в `signed_document.signatures`, отправляет on-chain `signiss2`
 *     с этим `actual_quantity` — C++ контракт сам исполняет корректирующие
 *     операции (`o.mkt.unlock` если actual<ordered / `o.mkt.lock` если
 *     actual>ordered, FR23) и `o.mkt.consum` (BURN w.mkt.order, Дт 86 /
 *     Кт 10, FR24). Order переводится READY_TO_RECEIVE → RECEIVED.
 *
 * При расхождении фактического количества с заказом и нехватке средств
 * пайщика на доплату (`actual > заказ`, L6 guard) транзакция `signiss2`
 * фейлится на цепи, backend пробрасывает ошибку клиенту с человеческим
 * сообщением (FR25).
 */
@Injectable()
export class MarketplaceIssuanceService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    private readonly documentDomainService: DocumentDomainService,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceIssuanceService.name);
  }

  /**
   * Preview-документ для подписания председателем КУ (первая подпись АПП
   * выдачи). Рендерится через factory под registry_id=1102. Клиент
   * подписывает hash приватным ключом председателя и возвращает результат
   * в `openIssuance`.
   */
  async getOpenIssuanceSignablePayload(
    coopname: string,
    order_id: string,
    chairman_account: string,
    actual_quantity?: number
  ): Promise<DocumentDomainEntity> {
    const order = await this.loadOrder(coopname, order_id);
    if (order.status !== 'ACCEPTED_TO_COOP') {
      throw new ConflictException(
        `Заказ в статусе «${order.status}», открытие выдачи недопустимо.`
      );
    }
    // Оператор сверяет факт при открытии: акт формируется на фактически
    // выдаваемое количество. Если оператор ещё не скорректировал — по заказу.
    const fact_quantity =
      actual_quantity && actual_quantity > 0 ? actual_quantity : order.quantity;
    return this.generateIssueActDocument({
      order,
      transmitter: chairman_account,
      actual_quantity: fact_quantity,
    });
  }

  /**
   * Документ для финальной подписи заказчика (вторая подпись АПП выдачи).
   * Канон двухподписного акта (как закрытие АПП приёмки председателем):
   * backend отдаёт DocumentAggregate — исходный документ из стора по doc_hash
   * (`rawDocument`, для ознакомления) + документ, уже подписанный председателем
   * (`document`, с его подписью). Заказчик накладывает свою подпись поверх:
   * `signDocument(rawDocument, orderer, 2, [document])`. Фронтенд цепь не читает.
   */
  async getFinalizeIssuanceSignablePayload(
    coopname: string,
    order_id: string
  ): Promise<DocumentDomainAggregate> {
    const order = await this.loadOrder(coopname, order_id);
    if (order.status !== 'READY_TO_RECEIVE') {
      throw new ConflictException(
        `Заказ в статусе «${order.status}», финальная подпись выдачи недопустима.`
      );
    }
    const signed = order.issue_act_signiss1_document;
    if (!signed) {
      throw new ConflictException(
        `Заказ ${order.id}: нет документа, подписанного председателем при открытии выдачи — финальная подпись недоступна до открытия выдачи.`
      );
    }
    const aggregate = await this.documentDomainService.buildDocumentAggregate(signed);
    if (!aggregate) {
      throw new ConflictException(
        `Заказ ${order.id}: исходный документ акта выдачи по doc_hash ${signed.doc_hash} не найден в сторе. Требуется заново открыть выдачу (тело документа не сохранено).`
      );
    }
    return aggregate;
  }

  async openIssuance(input: MarketplaceOpenIssuanceInput): Promise<MarketplaceIssuanceResult> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    if (order.status !== 'ACCEPTED_TO_COOP') {
      throw new ConflictException(
        `Заказ в статусе «${order.status}», открытие выдачи недопустимо.`
      );
    }
    if (order.chairman_signed_at !== null) {
      throw new ConflictException('Первая подпись выдачи уже зафиксирована для этого заказа.');
    }
    if (input.actual_quantity <= 0) {
      throw new BadRequestException('Фактическое количество должно быть больше нуля.');
    }

    this.verifyDocumentSignature(input.signed_document);

    // Факт фиксируется оператором при открытии выдачи и сохраняется на заказе;
    // финальная подпись заказчика берёт его из снапшота, а не редактирует.
    const factSnapshot = this.buildIssuanceFactSnapshot(order, input.actual_quantity);

    const act = new SignedDigitalDocumentInputDTO(input.signed_document).toDocument() as MarketContract.Actions.SignIss1.ISignIss1['act'];

    let tx;
    try {
      tx = await this.chainPort.signIss1({
        coopname: order.coopname,
        signer: input.chairman_account,
        order_hash: order.order_hash,
        act,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Открытие выдачи order ${order.id}: on-chain signiss1 упал (${message}); статус не меняется, повторите подпись.`
      );
      throw new ConflictException(
        `Открытие выдачи на цепи не выполнено: ${message}. Повторите подписание.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      // Если on-chain ответ не содержит хэша, мы не сможем восстановить
      // tx по запросу аудитора; синтетический hash 'signiss1-<uuid>' попадёт
      // в audit-trail как несуществующий — лучше отдать ошибку и повторить.
      throw new ConflictException(
        `Не получен tx_hash от блокчейна для open issuance order ${order.id}. Повторите подписание.`
      );
    }
    const updated = await this.orderRepo.applyIssuanceOpened(order.id, {
      chairman_account: input.chairman_account,
      signiss1_tx_hash: txHash,
      current_warehouse_braname: order.delivery_braname,
      // факт зафиксирован оператором при открытии — сохраняем снапшот, чтобы
      // финальная подпись заказчика взяла actual_quantity отсюда.
      issuance_fact: factSnapshot,
      // канон 2-подписи: сохраняем подписанный председателем документ, чтобы
      // заказчик получил его как DocumentAggregate и наложил вторую подпись.
      issue_act_signiss1_document:
        input.signed_document as unknown as ISignedDocumentDomainInterface,
    });

    this.logger.log(
      `Выдача order ${order.id} открыта председателем ${input.chairman_account} (tx=${txHash}); статус READY_TO_RECEIVE.`
    );

    // Story 6.1 / FR22: push заказчику — заказ готов на ПВЗ.
    const event: MarketplaceOrderReadyToReceiveEvent = {
      coopname: updated.coopname,
      order_id: updated.id,
      order_hash: updated.order_hash,
      orderer_account: updated.orderer_account,
      braname: updated.delivery_braname,
    };
    this.eventBus.emit(MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT, event);

    return { order: updated, tx_hash: txHash };
  }

  async finalizeIssuance(
    input: MarketplaceFinalizeIssuanceInput
  ): Promise<MarketplaceIssuanceResult> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    // Канон выдачи: финальную подпись заказчик ставит сам в своём кабинете на
    // своём устройстве своим ключом. Авторизуем по самой подписи, а не по JWT
    // submitter'а: закрывающую подпись акта обязан нести ключ заказчика-владельца
    // заказа. Криптовалидность всех подписей проверяется ниже в
    // verifyDocumentSignature; submitter уже ограничен RoleGuard'ом
    // 'Issuance','sign:final'.
    const ordererSigned = (input.signed_document.signatures ?? []).some(
      (sig) => sig.signer === order.orderer_account
    );
    if (!ordererSigned) {
      throw new ForbiddenException(
        'Финальная подпись акта выдачи должна быть выполнена ключом заказчика-владельца заказа.'
      );
    }
    if (order.status !== 'READY_TO_RECEIVE') {
      throw new ConflictException(
        `Заказ в статусе «${order.status}», финальная подпись выдачи недопустима.`
      );
    }
    if (order.orderer_signed_at !== null) {
      throw new ConflictException(
        'Финальная подпись выдачи уже зафиксирована для этого заказа.'
      );
    }
    // Факт зафиксирован оператором при открытии выдачи (issuance_fact); сторона
    // кооператива — председатель, открывший выдачу (chairman_account). Заказчик
    // ничего из этого не передаёт и не редактирует.
    const actual_quantity = order.issuance_fact?.actual_quantity;
    if (!actual_quantity || actual_quantity <= 0) {
      throw new ConflictException(
        `Заказ ${order.id}: фактическое количество не зафиксировано при открытии выдачи — финализация недоступна.`
      );
    }
    const delivery_signer = order.chairman_account;
    if (!delivery_signer) {
      throw new ConflictException(
        `Заказ ${order.id}: не найден председатель, открывший выдачу — финализация недоступна.`
      );
    }

    this.verifyDocumentSignature(input.signed_document);

    const act = new SignedDigitalDocumentInputDTO(input.signed_document).toDocument() as MarketContract.Actions.SignIss2.ISignIss2['act'];

    let tx;
    try {
      tx = await this.chainPort.signIss2({
        coopname: order.coopname,
        orderer: order.orderer_account,
        order_hash: order.order_hash,
        actual_quantity,
        delivery_signer,
        act,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Финальная подпись выдачи order ${order.id}: on-chain signiss2 упал (${message}); статус не меняется, повторите подпись.`
      );
      throw new ConflictException(
        `Финальная подпись выдачи на цепи не выполнена: ${message}. Повторите подписание.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      throw new ConflictException(
        `Не получен tx_hash от блокчейна для finalize issuance order ${order.id}. Повторите подписание.`
      );
    }
    const factSnapshot = order.issuance_fact ?? this.buildIssuanceFactSnapshot(order, actual_quantity);
    const warrantyUntil =
      order.warranty_period_secs > 0
        ? new Date(Date.now() + order.warranty_period_secs * 1000)
        : null;

    const updated = await this.orderRepo.applyIssuanceFinalized(order.id, {
      delivery_signer_account: delivery_signer,
      signiss2_tx_hash: txHash,
      issuance_fact: factSnapshot,
      warranty_until: warrantyUntil,
    });

    this.logger.log(
      `Выдача order ${order.id} завершена: actual_quantity=${actual_quantity}, diff=${factSnapshot.diff_state}, fact_cost=${factSnapshot.fact_cost} (tx=${txHash}).`
    );

    return { order: updated, tx_hash: txHash };
  }

  // ── private ──

  private async loadOrder(
    coopname: string,
    order_id: string
  ): Promise<MarketplaceOrderDomainEntity> {
    const order = await this.orderRepo.findById(order_id);
    if (!order || order.coopname !== coopname) {
      throw new NotFoundException(`Заказ ${order_id} не найден.`);
    }
    return order;
  }

  private async generateIssueActDocument(input: {
    order: MarketplaceOrderDomainEntity;
    transmitter: string;
    actual_quantity: number;
  }): Promise<DocumentDomainEntity> {
    const total_amount = (
      input.actual_quantity * Number.parseFloat(input.order.price_per_unit)
    ).toFixed(4);
    const action: Cooperative.Registry.MarketplaceAplReception.Action = {
      registry_id: Cooperative.Registry.MarketplaceAplReception.registry_id,
      coopname: input.order.coopname,
      username: input.order.orderer_account,
      order_id: input.order.id,
      order_hash: input.order.order_hash,
      reception_id: input.order.id,
      act_id: this.formatActId(input.order.id),
      transmitter: input.transmitter,
      braname: input.order.delivery_braname,
      accept_braname: input.order.delivery_braname,
      fact_quantity: input.actual_quantity,
      total_amount,
      supplier_account: input.order.supplier_account,
      // false: тело акта выдачи сохраняется в стор документов, чтобы заказчик
      // мог получить исходник по doc_hash через buildDocumentAggregate и
      // наложить вторую подпись поверх подписи председателя (канон 2-подписи).
      skip_save: false,
    };
    return this.documentDomainService.generateDocument({ data: action });
  }

  private formatActId(order_id: string): string {
    const orderShort = order_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `ISS-${orderShort}`;
  }

  private buildIssuanceFactSnapshot(
    order: MarketplaceOrderDomainEntity,
    actual_quantity: number
  ): MarketplaceOrderIssuanceFactSnapshot {
    const unitPrice = Number.parseFloat(order.price_per_unit);
    const fact_cost = (actual_quantity * unitPrice).toFixed(4);
    let diff_state: MarketplaceOrderIssuanceFactSnapshot['diff_state'];
    if (actual_quantity === order.quantity) diff_state = 'equal';
    else if (actual_quantity < order.quantity) diff_state = 'less';
    else diff_state = 'more';
    return { actual_quantity, fact_cost, diff_state };
  }

  private verifyDocumentSignature(document: ISignedDocumentDomainInterface): void {
    if (!document.signatures || document.signatures.length === 0) {
      throw new HttpApiError(http.BAD_REQUEST, 'Документ не подписан: signatures пуст.');
    }
    for (const sig of document.signatures) {
      const publicKey = PublicKey.from(sig.public_key);
      const signature = Signature.from(sig.signature);
      const verified = signature.verifyDigest(sig.signed_hash, publicKey);
      if (!verified) {
        throw new HttpApiError(http.BAD_REQUEST, 'Недействительная подпись акта выдачи.');
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
}

export const MARKETPLACE_ISSUANCE_SERVICE = Symbol('MARKETPLACE_ISSUANCE_SERVICE');
