import { createUnionType, Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Дискриминатор полезной нагрузки realtime-события marketplace.
 *
 * Поле служебное — НЕ публикуется как @Field; используется только в
 * resolveType union'а, чтобы выбрать конкретный тип на проводе. Издатель
 * (bridge) проставляет его в публикуемый объект.
 */
export enum MarketplaceEventType {
  ORDER_READY_TO_RECEIVE = 'ORDER_READY_TO_RECEIVE',
  RECEPTION_PENDING_SIGN = 'RECEPTION_PENDING_SIGN',
  OFFER_STOCK_CHANGED = 'OFFER_STOCK_CHANGED',
  OFFER_PUBLISHED = 'OFFER_PUBLISHED',
}

@ObjectType('MarketplaceOrderReadyToReceiveEvent', {
  description: 'Заказ пайщика собран на пункте и ожидает его подписи получения.',
})
export class MarketplaceOrderReadyToReceiveEventDTO {
  eventType!: MarketplaceEventType.ORDER_READY_TO_RECEIVE;

  @Field(() => String, { description: 'Идентификатор заказа.' })
  order_id!: string;

  @Field(() => String, { description: 'Контрольная сумма заказа.' })
  order_hash!: string;

  @Field(() => String, { description: 'Пункт выдачи, где заказ готов к получению.' })
  braname!: string;
}

@ObjectType('MarketplaceReceptionPendingSignEvent', {
  description: 'Поставка ожидает подписи поставщика на пункте приёмки.',
})
export class MarketplaceReceptionPendingSignEventDTO {
  eventType!: MarketplaceEventType.RECEPTION_PENDING_SIGN;

  @Field(() => String, { description: 'Идентификатор приёмки.' })
  reception_id!: string;

  @Field(() => String, { description: 'Наименование кооперативного участка приёмки.' })
  ku_name!: string;
}

@ObjectType('MarketplaceOfferStockChangedEvent', {
  description: 'У предложения в каталоге изменилось доступное количество.',
})
export class MarketplaceOfferStockChangedEventDTO {
  eventType!: MarketplaceEventType.OFFER_STOCK_CHANGED;

  @Field(() => String, { description: 'Идентификатор предложения.' })
  offer_id!: string;

  @Field(() => Int, { description: 'Доступное к заказу количество единиц.' })
  quantity_available!: number;

  @Field(() => Boolean, { description: 'Предложение без ограничения по количеству.' })
  unlimited_flag!: boolean;
}

@ObjectType('MarketplaceOfferPublishedEvent', {
  description: 'В каталоге появилось новое предложение.',
})
export class MarketplaceOfferPublishedEventDTO {
  eventType!: MarketplaceEventType.OFFER_PUBLISHED;

  @Field(() => String, { description: 'Идентификатор предложения.' })
  offer_id!: string;

  @Field(() => Int, { description: 'Категория предложения.' })
  category_id!: number;
}

/**
 * Объединение всех типов realtime-событий marketplace.
 *
 * Персональные события (заказ/приёмка) приходят пайщику-адресату, события
 * каталога (остаток/публикация) — широковещательно всем подписчикам
 * кооператива. Принцип «сигнал, а не данные»: payload несёт только
 * идентификаторы + минимальный контекст, чтобы клиент понял «что обновить».
 * Полные данные клиент дочитывает авторизованным query. Поэтому даже при
 * ошибке маршрутизации приватное в канал не утекает.
 */
export const MarketplaceEventUnion = createUnionType({
  name: 'MarketplaceEvent',
  types: () =>
    [
      MarketplaceOrderReadyToReceiveEventDTO,
      MarketplaceReceptionPendingSignEventDTO,
      MarketplaceOfferStockChangedEventDTO,
      MarketplaceOfferPublishedEventDTO,
    ] as const,
  resolveType(value: { eventType?: MarketplaceEventType }) {
    switch (value.eventType) {
      case MarketplaceEventType.ORDER_READY_TO_RECEIVE:
        return MarketplaceOrderReadyToReceiveEventDTO;
      case MarketplaceEventType.RECEPTION_PENDING_SIGN:
        return MarketplaceReceptionPendingSignEventDTO;
      case MarketplaceEventType.OFFER_STOCK_CHANGED:
        return MarketplaceOfferStockChangedEventDTO;
      case MarketplaceEventType.OFFER_PUBLISHED:
        return MarketplaceOfferPublishedEventDTO;
      default:
        return null;
    }
  },
});

export type MarketplaceEventPayload =
  | MarketplaceOrderReadyToReceiveEventDTO
  | MarketplaceReceptionPendingSignEventDTO
  | MarketplaceOfferStockChangedEventDTO
  | MarketplaceOfferPublishedEventDTO;
