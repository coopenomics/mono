import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { MarketplaceConsolidatedRequestDTO } from './marketplace-consolidated-request.dto';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import {
  MarketplaceOrderCycleTypes,
  MarketplaceOrderStatuses,
  type MarketplaceOrderCreateTxSnapshot,
  type MarketplaceOrderCycleType,
  type MarketplaceOrderStatus,
} from '../../domain/entities/marketplace-order.types';

export const MarketplaceOrderCycleTypeEnum = MarketplaceOrderCycleTypes;
export type MarketplaceOrderCycleTypeEnum =
  (typeof MarketplaceOrderCycleTypeEnum)[keyof typeof MarketplaceOrderCycleTypeEnum];

registerEnumType(MarketplaceOrderCycleTypeEnum, {
  name: 'MarketplaceOrderCycleType',
  description: 'Способ накопления заказов перед поставкой.',
  valuesMap: {
    TIME_BASED: { description: 'Поставка по истечении периода; собирается всё, что успело прийти.' },
    VOLUME_BASED: { description: 'Поставка стартует, когда набран целевой объём.' },
    OPEN_SUBSCRIPTION: { description: 'Поставщик запускает поставку вручную.' },
    INDIVIDUAL: { description: 'Каждый заказ обрабатывается отдельно, без накопления.' },
  },
});

export const MarketplaceOrderStatusEnum = MarketplaceOrderStatuses;
export type MarketplaceOrderStatusEnum =
  (typeof MarketplaceOrderStatusEnum)[keyof typeof MarketplaceOrderStatusEnum];

registerEnumType(MarketplaceOrderStatusEnum, {
  name: 'MarketplaceOrderStatus',
  description: 'Этап жизненного цикла заказа.',
});

export enum MarketplaceOrderIssuanceFactDiffStateEnum {
  EQUAL = 'equal',
  LESS = 'less',
  MORE = 'more',
}

registerEnumType(MarketplaceOrderIssuanceFactDiffStateEnum, {
  name: 'MarketplaceOrderIssuanceFactDiffState',
  description:
    'Сверка фактической выдачи с заказом: equal — совпало, less — выдано меньше, more — выдано больше с доплатой.',
});

@ObjectType('MarketplaceOrderIssuanceFactSnapshot', {
  description: 'Фактическая выдача имущества пайщику на ПВЗ.',
})
export class MarketplaceOrderIssuanceFactSnapshotDTO {
  @Field(() => Int, { description: 'Фактически выданное количество единиц.' })
  public readonly actual_quantity!: number;

  @Field(() => String, { description: 'Фактическая стоимость выдачи (actual_quantity × цена за единицу).' })
  public readonly fact_cost!: string;

  @Field(() => MarketplaceOrderIssuanceFactDiffStateEnum, {
    description: 'Сверка фактической выдачи с заказом.',
  })
  public readonly diff_state!: MarketplaceOrderIssuanceFactDiffStateEnum;

  constructor(init: Partial<MarketplaceOrderIssuanceFactSnapshotDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceOrderCreateTxSnapshot', {
  description: 'Снимок транзакции резервирования средств: ссылки на блок и сумма резерва.',
})
export class MarketplaceOrderCreateTxSnapshotDTO {
  @Field(() => String, { description: 'Идентификатор транзакции в блокчейне.' })
  public readonly tx_hash!: string;

  @Field(() => Int, { description: 'Номер блока, в который попала транзакция.' })
  public readonly block_num!: number;

  @Field(() => String, { description: 'Сумма зарезервированных средств (строка денежного актива).' })
  public readonly locked_amount!: string;

  @Field(() => String, { description: 'Время подписания заказа (ISO 8601).' })
  public readonly signed_at!: string;

  constructor(init: Partial<MarketplaceOrderCreateTxSnapshotDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceOrder', { description: 'Заказ пайщика по предложению поставщика.' })
export class MarketplaceOrderDTO {
  @Field(() => String, { description: 'Идентификатор заказа.' })
  public readonly id!: string;

  @Field(() => String, { description: 'Кооператив, в котором сделан заказ.' })
  public readonly coopname!: string;

  @Field(() => String, { description: 'Хеш заказа в блокчейне (для сверки).' })
  public readonly order_hash!: string;

  @Field(() => String, { description: 'Аккаунт пайщика-заказчика.' })
  public readonly orderer_account!: string;

  @Field(() => String, { description: 'Идентификатор предложения, по которому оформлен заказ.' })
  public readonly offer_id!: string;

  @Field(() => String, { description: 'Хеш предложения в блокчейне (snapshot на момент заказа).' })
  public readonly offer_hash!: string;

  @Field(() => String, { description: 'Аккаунт поставщика.' })
  public readonly supplier_account!: string;

  @Field(() => String, { description: 'Имя пункта выдачи (ПВЗ), куда пайщик хочет получить заказ.' })
  public readonly delivery_braname!: string;

  @Field(() => Int, { description: 'Количество единиц товара в заказе.' })
  public readonly quantity!: number;

  @Field(() => String, { description: 'Цена за единицу товара на момент заказа.' })
  public readonly price_per_unit!: string;

  @Field(() => String, { description: 'Общая сумма заказа.' })
  public readonly total_cost!: string;

  @Field(() => MarketplaceOrderCycleTypeEnum, {
    description: 'Способ накопления заказов перед поставкой (копируется из предложения).',
  })
  public readonly cycle_type!: MarketplaceOrderCycleType;

  @Field(() => String, { nullable: true, description: 'Идентификатор партии-накопителя, если заказ присоединён.' })
  public readonly cycle_id!: string | null;

  @Field(() => Int, { description: 'Срок гарантии в секундах с момента получения.' })
  public readonly warranty_period_secs!: number;

  @Field(() => Date, { nullable: true, description: 'Дата окончания гарантии.' })
  public readonly warranty_until!: Date | null;

  @Field(() => MarketplaceOrderStatusEnum, { description: 'Текущий этап жизненного цикла заказа.' })
  public readonly status!: MarketplaceOrderStatus;

  @Field(() => String, { nullable: true, description: 'Текстовая причина последнего изменения статуса.' })
  public readonly last_status_reason!: string | null;

  @Field(() => Date, { nullable: true, description: 'Когда средства были заблокированы.' })
  public readonly blocked_at!: Date | null;

  @Field(() => Date, { nullable: true, description: 'Когда поставщик принял заказ.' })
  public readonly accepted_at!: Date | null;

  @Field(() => Date, { nullable: true, description: 'Когда пайщик получил заказ.' })
  public readonly received_at!: Date | null;

  @Field(() => Date, { nullable: true, description: 'Когда заказ был отменён.' })
  public readonly cancelled_at!: Date | null;

  @Field(() => MarketplaceOrderCreateTxSnapshotDTO, {
    nullable: true,
    description: 'Снимок транзакции блокировки средств (для отображения движений кошелька).',
  })
  public readonly create_tx!: MarketplaceOrderCreateTxSnapshotDTO | null;

  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок, на котором имущество физически лежит к моменту выдачи.',
  })
  public readonly current_warehouse_braname!: string | null;

  @Field(() => MarketplaceOrderIssuanceFactSnapshotDTO, {
    nullable: true,
    description: 'Фактическая выдача после финальной подписи заказчика (заполняется на ПВЗ).',
  })
  public readonly issuance_fact!: MarketplaceOrderIssuanceFactSnapshotDTO | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Когда председатель кооперативного участка открыл выдачу первой подписью.',
  })
  public readonly chairman_signed_at!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: 'Учётная запись председателя, открывшего выдачу первой подписью.',
  })
  public readonly chairman_account!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Хэш транзакции открытия выдачи в блокчейне.',
  })
  public readonly signiss1_tx_hash!: string | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Когда заказчик поставил финальную подпись на акте выдачи.',
  })
  public readonly orderer_signed_at!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: 'Учётная запись стороны кооператива, поставившей подпись вместе с заказчиком.',
  })
  public readonly delivery_signer_account!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Хэш транзакции финальной подписи выдачи в блокчейне.',
  })
  public readonly signiss2_tx_hash!: string | null;

  @Field(() => Date, { description: 'Когда запись о заказе создана в системе.' })
  public readonly created_at!: Date;

  @Field(() => Date, { description: 'Когда запись о заказе последний раз изменялась.' })
  public readonly updated_at!: Date;

  constructor(init: Partial<MarketplaceOrderDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceCreateOrderResult')
export class MarketplaceCreateOrderResultDTO {
  @Field(() => MarketplaceOrderDTO)
  public readonly order!: MarketplaceOrderDTO;

  @Field(() => MarketplaceOrderCreateTxSnapshotDTO)
  public readonly tx_snapshot!: MarketplaceOrderCreateTxSnapshotDTO;

  constructor(init: { order: MarketplaceOrderDTO; tx_snapshot: MarketplaceOrderCreateTxSnapshotDTO }) {
    this.order = init.order;
    this.tx_snapshot = init.tx_snapshot;
  }
}

@ObjectType('MarketplaceCancelOrderResult', { description: 'Результат отмены заказа пайщиком.' })
export class MarketplaceCancelOrderResultDTO {
  @Field(() => MarketplaceOrderDTO, { description: 'Заказ после перевода в отменённое состояние.' })
  public readonly order!: MarketplaceOrderDTO;

  @Field(() => String, { description: 'Идентификатор транзакции отмены в блокчейне.' })
  public readonly tx_hash!: string;

  constructor(init: { order: MarketplaceOrderDTO; tx_hash: string }) {
    this.order = init.order;
    this.tx_hash = init.tx_hash;
  }
}

@ObjectType('MarketplaceConsolidatedRequestActionResult', {
  description: 'Результат массового действия поставщика над пакетом заказов (приём или отклонение).',
})
export class MarketplaceConsolidatedRequestActionResultDTO {
  @Field(() => MarketplaceConsolidatedRequestDTO, {
    description: 'Сводная заявка после обработки.',
  })
  public readonly request!: MarketplaceConsolidatedRequestDTO;

  @Field(() => Int, { description: 'Сколько заказов входило в обработанный пакет.' })
  public readonly affected_orders!: number;

  @Field(() => Int, {
    description: 'Сколько заказов из пакета удалось провести в блокчейн.',
  })
  public readonly on_chain_succeeded!: number;

  @Field(() => Int, {
    description: 'Сколько заказов из пакета не удалось провести в блокчейн — потребуется повторная обработка.',
  })
  public readonly on_chain_failed!: number;

  constructor(init: {
    request: MarketplaceConsolidatedRequestDTO;
    affected_orders: number;
    on_chain_succeeded: number;
    on_chain_failed: number;
  }) {
    this.request = init.request;
    this.affected_orders = init.affected_orders;
    this.on_chain_succeeded = init.on_chain_succeeded;
    this.on_chain_failed = init.on_chain_failed;
  }
}

@ObjectType('MarketplaceOrderPaginationResult', { description: 'Постраничный список заказов.' })
export class MarketplaceOrderPaginationResultDTO extends createPaginationResult(
  MarketplaceOrderDTO,
  'MarketplaceOrder'
) {}

@ObjectType('MarketplaceSupplierOrderActionResult', {
  description: 'Результат индивидуального приёма или отклонения заказа поставщиком.',
})
export class MarketplaceSupplierOrderActionResultDTO {
  @Field(() => MarketplaceOrderDTO, {
    description: 'Заказ после изменения статуса.',
  })
  public readonly order!: MarketplaceOrderDTO;

  @Field(() => String, { description: 'Идентификатор транзакции приёма или отклонения.' })
  public readonly tx_hash!: string;

  constructor(init: { order: MarketplaceOrderDTO; tx_hash: string }) {
    this.order = init.order;
    this.tx_hash = init.tx_hash;
  }
}

export function toMarketplaceOrderCreateTxSnapshotDTO(
  s: MarketplaceOrderCreateTxSnapshot
): MarketplaceOrderCreateTxSnapshotDTO {
  return new MarketplaceOrderCreateTxSnapshotDTO(s);
}

export function toMarketplaceOrderDTO(o: MarketplaceOrderDomainEntity): MarketplaceOrderDTO {
  return new MarketplaceOrderDTO({
    id: o.id,
    coopname: o.coopname,
    order_hash: o.order_hash,
    orderer_account: o.orderer_account,
    offer_id: o.offer_id,
    offer_hash: o.offer_hash,
    supplier_account: o.supplier_account,
    delivery_braname: o.delivery_braname,
    quantity: o.quantity,
    price_per_unit: o.price_per_unit,
    total_cost: o.total_cost,
    cycle_type: o.cycle_type,
    cycle_id: o.cycle_id,
    warranty_period_secs: o.warranty_period_secs,
    warranty_until: o.warranty_until,
    status: o.status,
    last_status_reason: o.last_status_reason,
    blocked_at: o.blocked_at,
    accepted_at: o.accepted_at,
    received_at: o.received_at,
    cancelled_at: o.cancelled_at,
    create_tx: o.create_tx ? new MarketplaceOrderCreateTxSnapshotDTO(o.create_tx) : null,
    current_warehouse_braname: o.current_warehouse_braname,
    issuance_fact: o.issuance_fact
      ? new MarketplaceOrderIssuanceFactSnapshotDTO({
          actual_quantity: o.issuance_fact.actual_quantity,
          fact_cost: o.issuance_fact.fact_cost,
          diff_state: o.issuance_fact.diff_state as MarketplaceOrderIssuanceFactDiffStateEnum,
        })
      : null,
    chairman_signed_at: o.chairman_signed_at,
    chairman_account: o.chairman_account,
    signiss1_tx_hash: o.signiss1_tx_hash,
    orderer_signed_at: o.orderer_signed_at,
    delivery_signer_account: o.delivery_signer_account,
    signiss2_tx_hash: o.signiss2_tx_hash,
    created_at: o.created_at,
    updated_at: o.updated_at,
  });
}

