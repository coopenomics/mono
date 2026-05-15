import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MarketplaceConsolidatedRequestDTO } from './marketplace-consolidated-request.dto';

@ObjectType('MarketplaceOrderCreateTxSnapshot')
export class MarketplaceOrderCreateTxSnapshotDTO {
  @Field(() => String) public readonly tx_hash!: string;
  @Field(() => Int) public readonly block_num!: number;
  @Field(() => Boolean) public readonly did_convert!: boolean;
  @Field(() => Boolean) public readonly did_assign!: boolean;
  @Field(() => String, { description: 'Сумма BLOCK на w.mkt.member (asset amount string)' })
  public readonly blocked_amount!: string;
  @Field(() => String, { description: 'ISO timestamp клиентского signed_at' })
  public readonly signed_at!: string;

  constructor(init: Partial<MarketplaceOrderCreateTxSnapshotDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceOrder')
export class MarketplaceOrderDTO {
  @Field(() => String) public readonly id!: string;
  @Field(() => String) public readonly coopname!: string;

  @Field(() => String, { description: '64-hex on-chain order_hash (sync-key marketplace::orders).' })
  public readonly order_hash!: string;

  @Field(() => String) public readonly orderer_account!: string;
  @Field(() => String) public readonly offer_id!: string;
  @Field(() => String) public readonly offer_hash!: string;
  @Field(() => String) public readonly supplier_account!: string;

  @Field(() => String, { description: 'branch.name выбранного ПВЗ получения (Story 2.3).' })
  public readonly delivery_braname!: string;

  @Field(() => Int) public readonly quantity!: number;

  @Field(() => String, { description: 'Цена за единицу (numeric как string).' })
  public readonly price_per_unit!: string;

  @Field(() => String, { description: 'Итог K × price (asset amount string).' })
  public readonly total_cost!: string;

  @Field(() => String, { description: 'time_based | volume_based | open_subscription | individual' })
  public readonly cycle_type!: string;

  @Field(() => String, { nullable: true })
  public readonly cycle_id!: string | null;

  @Field(() => Int) public readonly warranty_period_secs!: number;

  @Field(() => Date, { nullable: true })
  public readonly warranty_until!: Date | null;

  @Field(() => String, { description: 'Жизненный цикл Order p.mkt.supply (см. Эпик 4 epics.md).' })
  public readonly status!: string;

  @Field(() => String, { nullable: true })
  public readonly last_status_reason!: string | null;

  @Field(() => Date, { nullable: true })
  public readonly blocked_at!: Date | null;

  @Field(() => Date, { nullable: true })
  public readonly accepted_at!: Date | null;

  @Field(() => Date, { nullable: true })
  public readonly received_at!: Date | null;

  @Field(() => Date, { nullable: true })
  public readonly cancelled_at!: Date | null;

  @Field(() => MarketplaceOrderCreateTxSnapshotDTO, { nullable: true })
  public readonly create_tx!: MarketplaceOrderCreateTxSnapshotDTO | null;

  @Field(() => Date) public readonly created_at!: Date;
  @Field(() => Date) public readonly updated_at!: Date;

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

@ObjectType('MarketplaceCancelOrderResult')
export class MarketplaceCancelOrderResultDTO {
  @Field(() => MarketplaceOrderDTO, { description: 'Order после applyStatusTransition в CANCELLED_BY_ORDERER.' })
  public readonly order!: MarketplaceOrderDTO;

  @Field(() => String, { description: 'tx_hash транзакции marketplace::cancelorder для аудита.' })
  public readonly tx_hash!: string;

  constructor(init: { order: MarketplaceOrderDTO; tx_hash: string }) {
    this.order = init.order;
    this.tx_hash = init.tx_hash;
  }
}

@ObjectType('MarketplaceConsolidatedRequestActionResult')
export class MarketplaceConsolidatedRequestActionResultDTO {
  @Field(() => MarketplaceConsolidatedRequestDTO, {
    description: 'Заявка после applyStatusTransition (ACCEPTED / DECLINED_BY_SUPPLIER).',
  })
  public readonly request!: MarketplaceConsolidatedRequestDTO;

  @Field(() => Int, { description: 'Количество Order\'ов в пуле заявки.' })
  public readonly affected_orders!: number;

  @Field(() => Int, {
    description: 'Сколько Order\'ов были успешно проведены on-chain (accept/decline action прошёл).',
  })
  public readonly on_chain_succeeded!: number;

  @Field(() => Int, {
    description: 'Сколько Order\'ов не удалось провести on-chain (повтор через manual reconciliation в Story 9.x).',
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

@ObjectType('MarketplaceSupplierOrderActionResult')
export class MarketplaceSupplierOrderActionResultDTO {
  @Field(() => MarketplaceOrderDTO, {
    description: 'Order после applyStatusTransition (ACCEPTED / CANCELLED_BY_SUPPLIER).',
  })
  public readonly order!: MarketplaceOrderDTO;

  @Field(() => String, { description: 'tx_hash транзакции accept/decline для аудита.' })
  public readonly tx_hash!: string;

  constructor(init: { order: MarketplaceOrderDTO; tx_hash: string }) {
    this.order = init.order;
    this.tx_hash = init.tx_hash;
  }
}
