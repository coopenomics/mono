import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_APL_RECEPTION_STATUS_CHANGED_EVENT,
  MARKETPLACE_APL_SUPPLIER_ONSITE_SIGN_REQUEST_EVENT,
  MARKETPLACE_OFFER_APPROVED_EVENT,
  MARKETPLACE_OFFER_COUNTERS_CHANGED_EVENT,
  MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT,
  MARKETPLACE_OFFER_REJECTED_EVENT,
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
  MARKETPLACE_ORDER_STATUS_CHANGED_EVENT,
  MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT,
  MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT,
  MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT,
  MARKETPLACE_STOCK_PROPOSAL_RESOLVED_EVENT,
  MARKETPLACE_ISSUANCE_SAGA_UPDATED_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT,
  MARKETPLACE_WRITEOFF_AUTHORIZED_EVENT,
  MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT,
  MARKETPLACE_WRITEOFF_EXECUTED_EVENT,
  MARKETPLACE_WRITEOFF_PROPOSED_EVENT,
  MARKETPLACE_WRITEOFF_REJECTED_EVENT,
  MarketplaceAplReceptionStatusChangedEvent,
  MarketplaceAplSupplierOnsiteSignRequestEvent,
  MarketplaceOfferApprovedEvent,
  MarketplaceOfferCountersChangedEvent,
  MarketplaceOfferModerationRequestedEvent,
  MarketplaceOfferRejectedEvent,
  MarketplaceOrderReadyToReceiveEvent,
  MarketplaceOrderStatusChangedEvent,
  MarketplaceReturnClaimDecidedEvent,
  MarketplaceReturnClaimSubmittedEvent,
  MarketplaceStockProposalCreatedEvent,
  MarketplaceStockProposalResolvedEvent,
  MarketplaceIssuanceSagaUpdatedEvent,
  MarketplaceSupplierPaymentConfirmedEvent,
  MarketplaceSupplierPaymentDeclinedEvent,
  MarketplaceWriteoffAuthorizedPayload,
  MarketplaceWriteoffDraftBuiltPayload,
  MarketplaceWriteoffExecutedPayload,
  MarketplaceWriteoffProposedPayload,
  MarketplaceWriteoffRejectedPayload,
} from '../events/marketplace-notification.events';
import {
  MarketplaceAplReceptionStatusChangedEventDTO,
  MarketplaceEventType,
  MarketplaceOfferModerationEventDTO,
  MarketplaceOfferPublishedEventDTO,
  MarketplaceOfferStockChangedEventDTO,
  MarketplaceOrderReadyToReceiveEventDTO,
  MarketplaceOrderStatusChangedEventDTO,
  MarketplacePaymentStatusChangedEventDTO,
  MarketplaceReceptionPendingSignEventDTO,
  MarketplaceReturnClaimStatusChangedEventDTO,
  MarketplaceStockProposalCreatedEventDTO,
  MarketplaceStockProposalResolvedEventDTO,
  MarketplaceIssuanceSagaUpdatedEventDTO,
  MarketplaceWriteoffStatusChangedEventDTO,
} from '../dto/marketplace-event.dto';
import type { MarketplaceAplReceptionStatusEnum } from '../dto/marketplace-apl-reception.dto';
import { MarketplaceOfferStatusEnum } from '../dto/marketplace-offer.dto';
import { MarketplaceOutgoingPaymentRequestStatusEnum } from '../dto/marketplace-outgoing-payment.dto';
import { MarketplaceReturnClaimStatusEnum } from '../dto/marketplace-return-claim.dto';
import { MarketplaceWriteoffProposalStatusEnum } from '../dto/marketplace-writeoff.dto';
import {
  marketplaceBoardTopic,
  marketplaceCatalogTopic,
  marketplaceMemberTopic,
  marketplaceModerationTopic,
  marketplaceStaffTopic,
} from './marketplace-realtime.topics';
import { REALTIME_CHANNEL_PORT, type IRealtimeChannelPort,
  LOGGER_PORT,
  type ILoggerPort,
} from '@coopenomics/innercoop';

/**
 * Решение председателя по возврату → статус заявления. Маппинг закреплён
 * семантикой `MarketplaceReturnClaimService` (каждое решение детерминированно
 * переводит заявление ровно в один статус).
 */
const RETURN_DECISION_TO_STATUS: Record<
  MarketplaceReturnClaimDecidedEvent['decision'],
  MarketplaceReturnClaimStatusEnum
> = {
  approve_visit: MarketplaceReturnClaimStatusEnum.APPROVED_FOR_VISIT,
  reject_remote: MarketplaceReturnClaimStatusEnum.REJECTED_REMOTELY,
  accept_at_visit: MarketplaceReturnClaimStatusEnum.PENDING_COUNCIL,
  reject_at_visit: MarketplaceReturnClaimStatusEnum.REJECTED_AT_VISIT,
  council_authorized: MarketplaceReturnClaimStatusEnum.ACCEPTED_BY_COUNCIL,
  council_declined: MarketplaceReturnClaimStatusEnum.DECLINED_BY_COUNCIL,
  hand_back: MarketplaceReturnClaimStatusEnum.HANDED_BACK,
};

/**
 * Мост: внутренние доменные события marketplace (EventEmitter2, эмитятся ПОСЛЕ
 * commit'а в PG — INV-12) → realtime-канал через PubSub.
 *
 * Персональные события (заказ/приёмка) маршрутизируются в топик конкретного
 * аккаунта-адресата (orderer/supplier) — гарантия приватности. События каталога
 * (остаток/публикация) публикуются в широковещательный топик кооператива: они
 * про публичную витрину, адресата нет. Payload — только сигнал (идентификаторы
 * + контекст), детали клиент дочитывает авторизованным query.
 */
@Injectable()
export class MarketplaceRealtimeBridge {
  constructor(
    @Inject(REALTIME_CHANNEL_PORT) private readonly pubSub: IRealtimeChannelPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceRealtimeBridge.name);
  }

  @OnEvent(MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT)
  async onOrderReadyToReceive(event: MarketplaceOrderReadyToReceiveEvent): Promise<void> {
    const payload: MarketplaceOrderReadyToReceiveEventDTO = {
      eventType: MarketplaceEventType.ORDER_READY_TO_RECEIVE,
      order_id: event.order_id,
      order_hash: event.order_hash,
      braname: event.braname,
    };
    const topic = marketplaceMemberTopic(event.coopname, event.orderer_account);
    this.logger.info(
      `[mp-ws] PUBLISH ORDER_READY_TO_RECEIVE → topic=${topic} order=${event.order_id}`
    );
    await this.pubSub.publish(topic, payload);
  }

  // Только очная приёмка (Вариант А): поставщик у стойки, экран перекрывается
  // гейтом по этому ws-сигналу. Вариант Б (экспедитор) сюда НЕ приходит —
  // там бумажная ТТН, передача подтверждена, overlay не нужен.
  @OnEvent(MARKETPLACE_APL_SUPPLIER_ONSITE_SIGN_REQUEST_EVENT)
  async onSupplierOnsiteSignRequest(
    event: MarketplaceAplSupplierOnsiteSignRequestEvent
  ): Promise<void> {
    const payload: MarketplaceReceptionPendingSignEventDTO = {
      eventType: MarketplaceEventType.RECEPTION_PENDING_SIGN,
      reception_id: event.apl_reception_id,
      ku_name: event.ku_name,
    };
    const topic = marketplaceMemberTopic(event.coopname, event.supplier_account);
    this.logger.info(
      `[mp-ws] PUBLISH RECEPTION_PENDING_SIGN (очно) → topic=${topic} reception=${event.apl_reception_id} supplier_account=${event.supplier_account}`
    );
    await this.pubSub.publish(topic, payload);
  }

  // Каталог: остаток предложения изменился — широковещательно всем подписчикам
  // кооператива, чтобы карточка обновила доступное количество без перехода.
  @OnEvent(MARKETPLACE_OFFER_COUNTERS_CHANGED_EVENT)
  async onOfferStockChanged(event: MarketplaceOfferCountersChangedEvent): Promise<void> {
    const payload: MarketplaceOfferStockChangedEventDTO = {
      eventType: MarketplaceEventType.OFFER_STOCK_CHANGED,
      offer_id: event.offer_id,
      quantity_available: event.quantity_available,
      unlimited_flag: event.unlimited_flag,
    };
    const topic = marketplaceCatalogTopic(platformSettings().coopname);
    this.logger.info(
      `[mp-ws] PUBLISH OFFER_STOCK_CHANGED → topic=${topic} offer=${event.offer_id} available=${event.quantity_available}`
    );
    await this.pubSub.publish(topic, payload);
  }

  // Каталог: предложение прошло модерацию и стало активным — широковещательно,
  // чтобы витрина показала новое предложение без перехода по страницам.
  @OnEvent(MARKETPLACE_OFFER_APPROVED_EVENT)
  async onOfferPublished(event: MarketplaceOfferApprovedEvent): Promise<void> {
    const payload: MarketplaceOfferPublishedEventDTO = {
      eventType: MarketplaceEventType.OFFER_PUBLISHED,
      offer_id: event.offer_id,
      category_id: event.category_id,
    };
    const topic = marketplaceCatalogTopic(platformSettings().coopname);
    this.logger.info(
      `[mp-ws] PUBLISH OFFER_PUBLISHED → topic=${topic} offer=${event.offer_id} category=${event.category_id}`
    );
    await this.pubSub.publish(topic, payload);
  }

  // requirement 76 (двухфазная докладка): персональный сигнал пайщику —
  // у него немедленно всплывает экран принятия предложения со склада.
  @OnEvent(MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT)
  async onStockProposalCreated(event: MarketplaceStockProposalCreatedEvent): Promise<void> {
    const payload: MarketplaceStockProposalCreatedEventDTO = {
      eventType: MarketplaceEventType.STOCK_PROPOSAL_CREATED,
      proposal_id: event.proposal_id,
      braname: event.braname,
    };
    const topic = marketplaceMemberTopic(event.coopname, event.member_account);
    this.logger.info(
      `[mp-ws] PUBLISH STOCK_PROPOSAL_CREATED → topic=${topic} proposal=${event.proposal_id}`
    );
    await this.pubSub.publish(topic, payload);
  }

  // Разрешение докладки: стойке оператора (live-статус предложения) и
  // пайщику (его экран закрывается/обновляется).
  @OnEvent(MARKETPLACE_STOCK_PROPOSAL_RESOLVED_EVENT)
  async onStockProposalResolved(event: MarketplaceStockProposalResolvedEvent): Promise<void> {
    const payload: MarketplaceStockProposalResolvedEventDTO = {
      eventType: MarketplaceEventType.STOCK_PROPOSAL_RESOLVED,
      proposal_id: event.proposal_id,
      braname: event.braname,
    };
    const staffTopic = marketplaceStaffTopic(event.coopname);
    const memberTopic = marketplaceMemberTopic(event.coopname, event.member_account);
    this.logger.info(
      `[mp-ws] PUBLISH STOCK_PROPOSAL_RESOLVED → topics=${staffTopic},${memberTopic} proposal=${event.proposal_id} resolution=${event.resolution}`
    );
    await this.pubSub.publish(staffTopic, payload);
    await this.pubSub.publish(memberTopic, payload);
  }

  // Сага выдачи (паевая модель): пайщику — чтобы устройство подписало
  // следующий документ или показало ожидание совета; стойке — чтобы закрыть
  // выдачу второй подписью или увидеть отмену.
  @OnEvent(MARKETPLACE_ISSUANCE_SAGA_UPDATED_EVENT)
  async onIssuanceSagaUpdated(event: MarketplaceIssuanceSagaUpdatedEvent): Promise<void> {
    const payload: MarketplaceIssuanceSagaUpdatedEventDTO = {
      eventType: MarketplaceEventType.ISSUANCE_SAGA_UPDATED,
      saga_id: event.saga_id,
      order_id: event.order_id,
      order_hash: event.order_hash,
      proposal_id: event.proposal_id,
      braname: event.braname,
      stage: event.stage,
      decision_mode: event.decision_mode,
    };
    const staffTopic = marketplaceStaffTopic(event.coopname);
    const memberTopic = marketplaceMemberTopic(event.coopname, event.member_account);
    this.logger.info(
      `[mp-ws] PUBLISH ISSUANCE_SAGA_UPDATED → topics=${staffTopic},${memberTopic} order=${event.order_id} stage=${event.stage}`
    );
    await this.pubSub.publish(staffTopic, payload);
    await this.pubSub.publish(memberTopic, payload);
  }

  // Статус заказа сменился — адресный сигнал обеим сторонам заказа в их
  // персональные топики. Заказчик и поставщик ждут перехода с разных столов
  // (кабинет / приёмка), поэтому публикуем в оба; если это один и тот же
  // аккаунт (поставщик заказал у себя) — не дублируем. Плюс служебный канал
  // персонала КУ: оператор у стойки выдачи ждёт подпись заказчика (signiss2 →
  // RECEIVED) и не может отпустить его, пока не увидит её на своём столе.
  @OnEvent(MARKETPLACE_ORDER_STATUS_CHANGED_EVENT)
  async onOrderStatusChanged(event: MarketplaceOrderStatusChangedEvent): Promise<void> {
    const payload: MarketplaceOrderStatusChangedEventDTO = {
      eventType: MarketplaceEventType.ORDER_STATUS_CHANGED,
      order_id: event.order_id,
      status: event.status,
      previous_status: event.previous_status,
    };
    const recipients = new Set([event.orderer_account, event.supplier_account]);
    for (const account of recipients) {
      const topic = marketplaceMemberTopic(event.coopname, account);
      this.logger.info(
        `[mp-ws] PUBLISH ORDER_STATUS_CHANGED → topic=${topic} order=${event.order_id} ${event.previous_status}→${event.status}`
      );
      await this.pubSub.publish(topic, payload);
    }
    await this.pubSub.publish(marketplaceStaffTopic(event.coopname), payload);
  }

  // Статус акта приёмки сменился (создан / поставщик подписал / председатель
  // закрыл). Подпись поставщика НЕ двигает статусы заказов, а оператор у стойки
  // ждёт именно её — поэтому отдельный сигнал: персоналу КУ (служебный канал)
  // и поставщику (его стол «Подпись приёмки»).
  @OnEvent(MARKETPLACE_APL_RECEPTION_STATUS_CHANGED_EVENT)
  async onAplReceptionStatusChanged(
    event: MarketplaceAplReceptionStatusChangedEvent
  ): Promise<void> {
    const payload: MarketplaceAplReceptionStatusChangedEventDTO = {
      eventType: MarketplaceEventType.RECEPTION_STATUS_CHANGED,
      reception_id: event.apl_reception_id,
      status: event.status as MarketplaceAplReceptionStatusEnum,
      braname: event.braname,
    };
    const staffTopic = marketplaceStaffTopic(event.coopname);
    const supplierTopic = marketplaceMemberTopic(event.coopname, event.supplier_account);
    this.logger.info(
      `[mp-ws] PUBLISH RECEPTION_STATUS_CHANGED → topics=${staffTopic},${supplierTopic} reception=${event.apl_reception_id} status=${event.status}`
    );
    await this.pubSub.publish(staffTopic, payload);
    await this.pubSub.publish(supplierTopic, payload);
  }

  // Заявление на возврат подано (PENDING_CHAIRMAN_REVIEW). Стол возвратов
  // оператора КУ доставки должен показать новое заявление сразу — пайщик
  // может стоять у стойки; заказчику сигнал подтверждает приём заявления.
  @OnEvent(MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT)
  async onReturnClaimSubmitted(event: MarketplaceReturnClaimSubmittedEvent): Promise<void> {
    await this.publishReturnClaimStatus(
      event.coopname,
      event.claim_id,
      MarketplaceReturnClaimStatusEnum.PENDING_CHAIRMAN_REVIEW,
      event.delivery_braname,
      event.orderer_account
    );
  }

  // Решение по возврату (оператор удалённо / у стойки, совет, выдача обратно).
  // Заказчик видит вердикт мгновенно — в том числе стоя у стойки; стол
  // оператора обновляет ленту. Решение совета, пришедшее через дни, тем же
  // сигналом обновит экран ожидания пайщика.
  @OnEvent(MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT)
  async onReturnClaimDecided(event: MarketplaceReturnClaimDecidedEvent): Promise<void> {
    await this.publishReturnClaimStatus(
      event.coopname,
      event.claim_id,
      RETURN_DECISION_TO_STATUS[event.decision],
      event.braname,
      event.orderer_account
    );
  }

  private async publishReturnClaimStatus(
    coopname: string,
    claim_id: string,
    status: MarketplaceReturnClaimStatusEnum,
    braname: string,
    orderer_account: string
  ): Promise<void> {
    const payload: MarketplaceReturnClaimStatusChangedEventDTO = {
      eventType: MarketplaceEventType.RETURN_CLAIM_STATUS_CHANGED,
      claim_id,
      status,
      braname,
    };
    const staffTopic = marketplaceStaffTopic(coopname);
    const ordererTopic = marketplaceMemberTopic(coopname, orderer_account);
    this.logger.info(
      `[mp-ws] PUBLISH RETURN_CLAIM_STATUS_CHANGED → topics=${staffTopic},${ordererTopic} claim=${claim_id} status=${status}`
    );
    await this.pubSub.publish(staffTopic, payload);
    await this.pubSub.publish(ordererTopic, payload);
  }

  // Предложение поступило на модерацию — очередь на столе председателя
  // пополняется сразу. Поставщику сигнал не нужен: это его собственное
  // действие, его стол обновился локально.
  @OnEvent(MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT)
  async onOfferModerationRequested(
    event: MarketplaceOfferModerationRequestedEvent
  ): Promise<void> {
    await this.publishOfferModeration(
      event.offer_id,
      MarketplaceOfferStatusEnum.PENDING_MODERATION
    );
  }

  // Предложение одобрено (или вернулось в каталог republish'ем) — очередь
  // модерации сокращается; поставщик видит одобрение на своём столе сразу.
  // Каталожный сигнал OFFER_PUBLISHED уходит отдельным handler'ом выше.
  @OnEvent(MARKETPLACE_OFFER_APPROVED_EVENT)
  async onOfferModerationApproved(event: MarketplaceOfferApprovedEvent): Promise<void> {
    await this.publishOfferModeration(
      event.offer_id,
      MarketplaceOfferStatusEnum.ACTIVE,
      event.supplier_account
    );
  }

  // Предложение отклонено модератором — поставщик узнаёт об отказе мгновенно,
  // очередь модерации обновляется у остальных модераторов.
  @OnEvent(MARKETPLACE_OFFER_REJECTED_EVENT)
  async onOfferModerationRejected(event: MarketplaceOfferRejectedEvent): Promise<void> {
    await this.publishOfferModeration(
      event.offer_id,
      MarketplaceOfferStatusEnum.REJECTED,
      event.supplier_account
    );
  }

  private async publishOfferModeration(
    offer_id: string,
    status: MarketplaceOfferStatusEnum,
    supplier_account?: string
  ): Promise<void> {
    const payload: MarketplaceOfferModerationEventDTO = {
      eventType: MarketplaceEventType.OFFER_MODERATION_CHANGED,
      offer_id,
      status,
    };
    const moderationTopic = marketplaceModerationTopic(platformSettings().coopname);
    this.logger.info(
      `[mp-ws] PUBLISH OFFER_MODERATION_CHANGED → topic=${moderationTopic} offer=${offer_id} status=${status}`
    );
    await this.pubSub.publish(moderationTopic, payload);
    if (supplier_account) {
      await this.pubSub.publish(
        marketplaceMemberTopic(platformSettings().coopname, supplier_account),
        payload
      );
    }
  }

  // Кассир подтвердил банковский перевод поставщику — история выплат
  // поставщика отражает COMPLETED без поллинга.
  @OnEvent(MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT)
  async onSupplierPaymentConfirmed(
    event: MarketplaceSupplierPaymentConfirmedEvent
  ): Promise<void> {
    await this.publishPaymentStatus(
      event.coopname,
      event.payment_request_id,
      MarketplaceOutgoingPaymentRequestStatusEnum.COMPLETED,
      event.supplier_account
    );
  }

  // Кассир отклонил выплату — поставщик видит отказ сразу и может выяснить
  // причину, не дожидаясь перезагрузки страницы.
  @OnEvent(MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT)
  async onSupplierPaymentDeclined(
    event: MarketplaceSupplierPaymentDeclinedEvent
  ): Promise<void> {
    await this.publishPaymentStatus(
      event.coopname,
      event.payment_request_id,
      MarketplaceOutgoingPaymentRequestStatusEnum.DECLINED,
      event.supplier_account
    );
  }

  private async publishPaymentStatus(
    coopname: string,
    payment_request_id: string,
    status: MarketplaceOutgoingPaymentRequestStatusEnum,
    supplier_account: string
  ): Promise<void> {
    const payload: MarketplacePaymentStatusChangedEventDTO = {
      eventType: MarketplaceEventType.PAYMENT_STATUS_CHANGED,
      payment_request_id,
      status,
    };
    const topic = marketplaceMemberTopic(coopname, supplier_account);
    this.logger.info(
      `[mp-ws] PUBLISH PAYMENT_STATUS_CHANGED → topic=${topic} payment=${payment_request_id} status=${status}`
    );
    await this.pubSub.publish(topic, payload);
  }

  // ── Списания: повестка совета и склады КУ ───────────────────────────
  //
  // Жизненный цикл проекта списания (сформирован → в повестке → авторизован →
  // исполнен / отклонён) ведут cron и совет — для столов повестки и админ-листа
  // это внешние изменения. Исполненное списание к тому же опустошает склад КУ.
  // Адресаты: канал совета (member/chairman) + служебный канал персонала КУ.

  @OnEvent(MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT)
  async onWriteoffDraftBuilt(event: MarketplaceWriteoffDraftBuiltPayload): Promise<void> {
    await this.publishWriteoffStatus(
      event.coopname,
      event.proposal_id,
      MarketplaceWriteoffProposalStatusEnum.DRAFT
    );
  }

  @OnEvent(MARKETPLACE_WRITEOFF_PROPOSED_EVENT)
  async onWriteoffProposed(event: MarketplaceWriteoffProposedPayload): Promise<void> {
    await this.publishWriteoffStatus(
      event.coopname,
      event.proposal_id,
      MarketplaceWriteoffProposalStatusEnum.ON_AGENDA
    );
  }

  @OnEvent(MARKETPLACE_WRITEOFF_AUTHORIZED_EVENT)
  async onWriteoffAuthorized(event: MarketplaceWriteoffAuthorizedPayload): Promise<void> {
    await this.publishWriteoffStatus(
      event.coopname,
      event.proposal_id,
      MarketplaceWriteoffProposalStatusEnum.AUTHORIZED
    );
  }

  @OnEvent(MARKETPLACE_WRITEOFF_EXECUTED_EVENT)
  async onWriteoffExecuted(event: MarketplaceWriteoffExecutedPayload): Promise<void> {
    await this.publishWriteoffStatus(
      event.coopname,
      event.proposal_id,
      MarketplaceWriteoffProposalStatusEnum.EXECUTED
    );
  }

  @OnEvent(MARKETPLACE_WRITEOFF_REJECTED_EVENT)
  async onWriteoffRejected(event: MarketplaceWriteoffRejectedPayload): Promise<void> {
    await this.publishWriteoffStatus(
      event.coopname,
      event.proposal_id,
      MarketplaceWriteoffProposalStatusEnum.REJECTED
    );
  }

  private async publishWriteoffStatus(
    coopname: string,
    proposal_id: string,
    status: MarketplaceWriteoffProposalStatusEnum
  ): Promise<void> {
    const payload: MarketplaceWriteoffStatusChangedEventDTO = {
      eventType: MarketplaceEventType.WRITEOFF_STATUS_CHANGED,
      proposal_id,
      status,
    };
    const boardTopic = marketplaceBoardTopic(coopname);
    const staffTopic = marketplaceStaffTopic(coopname);
    this.logger.info(
      `[mp-ws] PUBLISH WRITEOFF_STATUS_CHANGED → topics=${boardTopic},${staffTopic} proposal=${proposal_id} status=${status}`
    );
    await this.pubSub.publish(boardTopic, payload);
    await this.pubSub.publish(staffTopic, payload);
  }
}
