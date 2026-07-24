import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { MarketplaceConsolidatedRequestDTO } from './marketplace-consolidated-request.dto';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import {
  MarketplaceOrderStatuses,
  type MarketplaceOrderCreateTxSnapshot,
  type MarketplaceOrderStatus,
} from '../../domain/entities/marketplace-order.types';

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
  @Field(() => Float, { description: 'Фактически выданное количество единиц.' })
  public readonly actual_quantity!: number;

  @Field(() => String, { description: 'Фактическая цена за единицу (скорректирована оператором при открытии выдачи).' })
  public readonly fact_unit_price!: string;

  @Field(() => String, { description: 'Фактическая стоимость выдачи (actual_quantity × фактическая цена за единицу).' })
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

  @Field(() => String, {
    nullable: true,
    description: 'Наименование заказчика (ФИО пайщика или название организации) — для экранов выдачи/подписи.',
  })
  public readonly orderer_name!: string | null;

  @Field(() => String, { description: 'Идентификатор предложения, по которому оформлен заказ.' })
  public readonly offer_id!: string;

  @Field(() => String, { description: 'Хеш предложения в блокчейне (snapshot на момент заказа).' })
  public readonly offer_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название товара из предложения — для отображения в карточке заказа.',
  })
  public readonly product_name!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Базовая единица измерения товара из предложения (штука, килограмм, литр).',
  })
  public readonly unit_of_measure!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Размер единицы заказа (фасовки) в базовых единицах из предложения: сколько ' +
      'базовых единиц входит в одну единицу заказа. «0.1» — по 100 г, «8» — упаковка из 8 штук.',
  })
  public readonly order_unit_size!: string | null;

  @Field(() => String, { description: 'Аккаунт поставщика.' })
  public readonly supplier_account!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Наименование поставщика (ФИО или название организации) — для экранов приёмки/подписи.',
  })
  public readonly supplier_name!: string | null;

  @Field(() => String, { description: 'Имя пункта выдачи (ПВЗ), куда пайщик хочет получить заказ.' })
  public readonly delivery_braname!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Наименование пункта выдачи (кооперативного участка) — для отображения вместо служебного идентификатора ПВЗ.',
  })
  public readonly delivery_point_name!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Адрес пункта выдачи — для отображения вместо служебного идентификатора ПВЗ.',
  })
  public readonly delivery_point_address!: string | null;

  @Field(() => Float, {
    nullable: true,
    description: 'Широта пункта выдачи на карте — чтобы показать заказчику, куда ехать за заказом.',
  })
  public readonly delivery_point_lat!: number | null;

  @Field(() => Float, {
    nullable: true,
    description: 'Долгота пункта выдачи на карте — чтобы показать заказчику, куда ехать за заказом.',
  })
  public readonly delivery_point_lng!: number | null;

  @Field(() => Float, { description: 'Количество единиц товара в заказе.' })
  public readonly quantity!: number;

  @Field(() => Float, {
    nullable: true,
    description:
      'Сколько по заказу фактически принято на склад пункта выдачи и ещё не ' +
      'выдано — доступно к выдаче. Может быть меньше заказанного при ' +
      'недопоставке. Заполняется в лентах выдачи.',
  })
  public readonly warehouse_quantity!: number | null;

  @Field(() => [String], {
    nullable: true,
    description:
      'Полки склада пункта выдачи, на которых лежат позиции заказа после ' +
      'раскладки. Пусто — позиции ещё не разложены по полкам. Заполняется в ' +
      'лентах выдачи.',
  })
  public readonly warehouse_shelves!: string[] | null;

  @Field(() => Float, {
    nullable: true,
    description:
      'Сколько уже накоплено по этому предложению на данном пункте выдачи всеми ' +
      'заказчиками на этапе сбора партии (для прогресса коллективного заказа). ' +
      'Заполняется только пока заказ копится; после приёма поставщиком — пусто.',
  })
  public readonly group_accumulated_quantity!: number | null;

  @Field(() => Float, {
    nullable: true,
    description:
      'Целевой минимальный объём поставки на этот пункт выдачи — ориентир сбора ' +
      'партии (не жёсткий порог). Заполняется только на этапе сбора.',
  })
  public readonly group_min_volume!: number | null;

  @Field(() => String, { description: 'Цена за единицу товара на момент заказа.' })
  public readonly price_per_unit!: string;

  @Field(() => String, { description: 'Общая сумма заказа (стоимость имущества без членского взноса).' })
  public readonly total_cost!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Членский взнос, включённый в стоимость заказа, по ставке на момент оформления. ' +
      'Заказчик платит total_cost + membership_fee; пусто — заказ ещё не подтверждён блокчейном.',
  })
  public readonly membership_fee!: string | null;

  @Field(() => String, {
    description:
      'Полная сумма к оплате заказчиком: total_cost + membership_fee. Готовое значение — ' +
      'клиенту не нужно складывать поля самому.',
  })
  public readonly total_cost_with_fee!: string;

  @Field(() => String, { nullable: true, description: 'Идентификатор партии-накопителя, если заказ присоединён.' })
  public readonly cycle_id!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Идентификатор заказа заказчика — общий для всех позиций одного оформления корзины на один пункт выдачи. ' +
      'Позволяет сгруппировать позиции в один заказ. Пусто для прежних покарточных заказов.',
  })
  public readonly checkout_id!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Партия поставки (shipment), в которую заказ включён при формировании. null — заказ ' +
      'акцептован, но в партию не вошёл. Позволяет приёмке отделить состав конкретной партии.',
  })
  public readonly shipment_id!: string | null;

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

@ObjectType('MarketplaceOrderPaginationResult', { description: 'Постраничный список заказов.' })
export class MarketplaceOrderPaginationResultDTO extends createPaginationResult(
  MarketplaceOrderDTO,
  'MarketplaceOrder'
) {}

@ObjectType('MarketplaceSupplierBatchActionResult', {
  description: 'Результат массового приёма или отказа поставщика над выбранными заказами.',
})
export class MarketplaceSupplierBatchActionResultDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Идентификатор партии-накопителя, в которую обёрнуты принятые заказы (null при отказе).',
  })
  public readonly cycle_id!: string | null;

  @Field(() => [MarketplaceOrderDTO], { description: 'Заказы после изменения статуса.' })
  public readonly orders!: MarketplaceOrderDTO[];

  @Field(() => [String], { description: 'Идентификаторы транзакций приёма/отказа в блокчейне.' })
  public readonly tx_hashes!: string[];

  constructor(init: { cycle_id: string | null; orders: MarketplaceOrderDTO[]; tx_hashes: string[] }) {
    this.cycle_id = init.cycle_id;
    this.orders = init.orders;
    this.tx_hashes = init.tx_hashes;
  }
}

export function toMarketplaceOrderCreateTxSnapshotDTO(
  s: MarketplaceOrderCreateTxSnapshot
): MarketplaceOrderCreateTxSnapshotDTO {
  return new MarketplaceOrderCreateTxSnapshotDTO(s);
}

/**
 * Отображаемые реквизиты, которыми резолвер обогащает заказ для UI: название
 * товара и единица измерения берутся из предложения, адрес — из детализации
 * ПВЗ. Не хранятся на самом заказе (заказ ссылается на предложение/ПВЗ по id),
 * поэтому подмешиваются в DTO на чтении. Best-effort: если предложение/ПВЗ не
 * найдены — поля остаются null, клиент показывает запасной вид.
 */
export interface MarketplaceOrderDisplayFields {
  product_name?: string | null;
  unit_of_measure?: string | null;
  order_unit_size?: string | null;
  delivery_point_name?: string | null;
  delivery_point_address?: string | null;
  delivery_point_lat?: number | null;
  delivery_point_lng?: number | null;
  orderer_name?: string | null;
  supplier_name?: string | null;
  group_accumulated_quantity?: number | null;
  group_min_volume?: number | null;
  warehouse_quantity?: number | null;
  warehouse_shelves?: string[] | null;
}

/**
 * `total_cost`/`membership_fee` — numeric(_, 4) колонки (scale колонки, не
 * MARKETPLACE_ASSET_CONFIG.decimals — блокчейн-символ здесь ни при чём,
 * складываются уже персистентные PG-значения). Фиксированные 4 знака держат
 * результат чистым от плавающей точки на типичных суммах; конечное округление
 * до валюты — на клиенте при отображении (formatAsset2Digits и т.п.).
 */
function sumOrderAmounts(total_cost: string, membership_fee: string | null): string {
  return (Number.parseFloat(total_cost) + Number.parseFloat(membership_fee ?? '0')).toFixed(4);
}

export function toMarketplaceOrderDTO(
  o: MarketplaceOrderDomainEntity,
  display?: MarketplaceOrderDisplayFields
): MarketplaceOrderDTO {
  return new MarketplaceOrderDTO({
    id: o.id,
    coopname: o.coopname,
    order_hash: o.order_hash,
    orderer_account: o.orderer_account,
    orderer_name: display?.orderer_name ?? null,
    offer_id: o.offer_id,
    offer_hash: o.offer_hash,
    product_name: display?.product_name ?? null,
    unit_of_measure: display?.unit_of_measure ?? null,
    order_unit_size: display?.order_unit_size ?? null,
    supplier_account: o.supplier_account,
    supplier_name: display?.supplier_name ?? null,
    delivery_braname: o.delivery_braname,
    delivery_point_name: display?.delivery_point_name ?? null,
    delivery_point_address: display?.delivery_point_address ?? null,
    delivery_point_lat: display?.delivery_point_lat ?? null,
    delivery_point_lng: display?.delivery_point_lng ?? null,
    quantity: o.quantity,
    warehouse_quantity: display?.warehouse_quantity ?? null,
    warehouse_shelves: display?.warehouse_shelves ?? null,
    group_accumulated_quantity: display?.group_accumulated_quantity ?? null,
    group_min_volume: display?.group_min_volume ?? null,
    price_per_unit: o.price_per_unit,
    total_cost: o.total_cost,
    membership_fee: o.membership_fee,
    total_cost_with_fee: sumOrderAmounts(o.total_cost, o.membership_fee),
    cycle_id: o.cycle_id,
    checkout_id: o.checkout_id,
    shipment_id: o.shipment_id,
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
          fact_unit_price: o.issuance_fact.fact_unit_price,
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

