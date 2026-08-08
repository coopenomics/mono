import { Injectable } from '@nestjs/common';
import { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceOutgoingPaymentRequestEntity } from '../entities/marketplace-outgoing-payment-request.entity';

@Injectable()
export class MarketplaceOutgoingPaymentRequestMapper {
  toDomain(
    row: MarketplaceOutgoingPaymentRequestEntity
  ): MarketplaceOutgoingPaymentRequestDomainEntity {
    return new MarketplaceOutgoingPaymentRequestDomainEntity({
      id: row.id,
      coopname: row.coopname,
      order_hash: row.order_hash,
      order_id: row.order_id,
      apl_reception_id: row.apl_reception_id,
      payee_account: row.payee_account,
      amount: row.amount,
      symbol: row.symbol,
      purpose: row.purpose,
      payout_destination: row.payout_destination,
      status: row.status,
      completed_at: row.completed_at,
      decline_reason: row.decline_reason,
      core_payment_id: row.core_payment_id,
      payout_tx_hash: row.payout_tx_hash,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
