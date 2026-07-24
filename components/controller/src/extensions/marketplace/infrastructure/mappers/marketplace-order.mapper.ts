import { Injectable } from '@nestjs/common';
import { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { MarketplaceOrderEntity } from '../entities/marketplace-order.entity';

/**
 * Row → domain. TypeORM `bigint` колонки приходят как string —
 * нормализуем в number/null для `on_chain_block_num` (см. controller/
 * CLAUDE.md правило «Bigint из PostgreSQL приходит как STRING»).
 */
@Injectable()
export class MarketplaceOrderMapper {
  toDomain(row: MarketplaceOrderEntity): MarketplaceOrderDomainEntity {
    return new MarketplaceOrderDomainEntity({
      id: row.id,
      coopname: row.coopname,
      order_hash: row.order_hash,
      orderer_account: row.orderer_account,
      offer_id: row.offer_id,
      offer_hash: row.offer_hash,
      supplier_account: row.supplier_account,
      delivery_braname: row.delivery_braname,
      quantity: row.quantity,
      price_per_unit: row.price_per_unit,
      total_cost: row.total_cost,
      membership_fee: row.membership_fee ?? null,
      cycle_id: row.cycle_id,
      checkout_id: row.checkout_id ?? null,
      shipment_id: row.shipment_id ?? null,
      warranty_period_secs: row.warranty_period_secs,
      warranty_until: row.warranty_until,
      status: row.status,
      last_status_reason: row.last_status_reason,
      blocked_at: row.blocked_at,
      accepted_at: row.accepted_at,
      received_at: row.received_at,
      cancelled_at: row.cancelled_at,
      create_tx: row.create_tx,
      current_warehouse_braname: row.current_warehouse_braname,
      issuance_fact: row.issuance_fact,
      ready_announced_at: row.ready_announced_at,
      chairman_signed_at: row.chairman_signed_at,
      chairman_account: row.chairman_account,
      signiss1_tx_hash: row.signiss1_tx_hash,
      issue_act_signiss1_document: row.issue_act_signiss1_document,
      orderer_signed_at: row.orderer_signed_at,
      delivery_signer_account: row.delivery_signer_account,
      signiss2_tx_hash: row.signiss2_tx_hash,
      on_chain_id: row.on_chain_id,
      on_chain_block_num:
        row.on_chain_block_num === null || row.on_chain_block_num === undefined
          ? null
          : Number(row.on_chain_block_num),
      on_chain_present: row.on_chain_present,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
