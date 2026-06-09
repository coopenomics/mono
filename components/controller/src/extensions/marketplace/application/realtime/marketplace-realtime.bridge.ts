import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import {
  MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT,
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
  MarketplaceAplSupplierSignRequestEvent,
  MarketplaceOrderReadyToReceiveEvent,
} from '../events/marketplace-notification.events';
import {
  MarketplaceEventType,
  MarketplaceOrderReadyToReceiveEventDTO,
  MarketplaceReceptionPendingSignEventDTO,
} from '../dto/marketplace-event.dto';
import { marketplaceMemberTopic } from './marketplace-realtime.topics';

/**
 * Мост: внутренние доменные события marketplace (EventEmitter2, эмитятся ПОСЛЕ
 * commit'а в PG — INV-12) → персональный realtime-канал адресата через PubSub.
 *
 * Маршрутизация по получателю — гарантия приватности: публикуем в топик
 * конкретного аккаунта-адресата (orderer/supplier), а не в общий канал.
 * Payload — только сигнал (идентификаторы + контекст), детали клиент
 * дочитывает авторизованным query.
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
    await this.pubSub.publish(
      marketplaceMemberTopic(event.coopname, event.orderer_account),
      payload
    );
  }

  @OnEvent(MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT)
  async onSupplierSignRequest(event: MarketplaceAplSupplierSignRequestEvent): Promise<void> {
    const payload: MarketplaceReceptionPendingSignEventDTO = {
      eventType: MarketplaceEventType.RECEPTION_PENDING_SIGN,
      reception_id: event.apl_reception_id,
      ku_name: event.ku_name,
    };
    await this.pubSub.publish(
      marketplaceMemberTopic(event.coopname, event.supplier_account),
      payload
    );
  }
}
