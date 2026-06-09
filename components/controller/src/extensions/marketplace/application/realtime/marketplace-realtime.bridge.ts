import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import config from '~/config/config';
import logger from '~/config/logger';
import {
  MARKETPLACE_APL_SUPPLIER_ONSITE_SIGN_REQUEST_EVENT,
  MARKETPLACE_OFFER_APPROVED_EVENT,
  MARKETPLACE_OFFER_COUNTERS_CHANGED_EVENT,
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
  MarketplaceAplSupplierOnsiteSignRequestEvent,
  MarketplaceOfferApprovedEvent,
  MarketplaceOfferCountersChangedEvent,
  MarketplaceOrderReadyToReceiveEvent,
} from '../events/marketplace-notification.events';
import {
  MarketplaceEventType,
  MarketplaceOfferPublishedEventDTO,
  MarketplaceOfferStockChangedEventDTO,
  MarketplaceOrderReadyToReceiveEventDTO,
  MarketplaceReceptionPendingSignEventDTO,
} from '../dto/marketplace-event.dto';
import { marketplaceCatalogTopic, marketplaceMemberTopic } from './marketplace-realtime.topics';

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
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  @OnEvent(MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT)
  async onOrderReadyToReceive(event: MarketplaceOrderReadyToReceiveEvent): Promise<void> {
    const payload: MarketplaceOrderReadyToReceiveEventDTO = {
      eventType: MarketplaceEventType.ORDER_READY_TO_RECEIVE,
      order_id: event.order_id,
      order_hash: event.order_hash,
      braname: event.braname,
    };
    const topic = marketplaceMemberTopic(event.coopname, event.orderer_account);
    logger.info(
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
    logger.info(
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
    const topic = marketplaceCatalogTopic(config.coopname);
    logger.info(
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
    const topic = marketplaceCatalogTopic(config.coopname);
    logger.info(
      `[mp-ws] PUBLISH OFFER_PUBLISHED → topic=${topic} offer=${event.offer_id} category=${event.category_id}`
    );
    await this.pubSub.publish(topic, payload);
  }
}
