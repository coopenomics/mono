import { createUnionType, Field, ObjectType } from '@nestjs/graphql';

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

/**
 * Объединение всех типов realtime-событий персонального канала пайщика.
 *
 * Принцип «сигнал, а не данные»: payload несёт только идентификаторы +
 * минимальный контекст, чтобы клиент понял «что обновить». Полные данные
 * (состав, цены, персональное) клиент дочитывает авторизованным query.
 * Поэтому даже при ошибке маршрутизации приватного в канал не утекает.
 */
export const MarketplaceEventUnion = createUnionType({
  name: 'MarketplaceEvent',
  types: () =>
    [MarketplaceOrderReadyToReceiveEventDTO, MarketplaceReceptionPendingSignEventDTO] as const,
  resolveType(value: { eventType?: MarketplaceEventType }) {
    switch (value.eventType) {
      case MarketplaceEventType.ORDER_READY_TO_RECEIVE:
        return MarketplaceOrderReadyToReceiveEventDTO;
      case MarketplaceEventType.RECEPTION_PENDING_SIGN:
        return MarketplaceReceptionPendingSignEventDTO;
      default:
        return null;
    }
  },
});

export type MarketplaceEventPayload =
  | MarketplaceOrderReadyToReceiveEventDTO
  | MarketplaceReceptionPendingSignEventDTO;
