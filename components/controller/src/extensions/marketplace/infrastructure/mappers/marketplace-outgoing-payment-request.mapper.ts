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
      apl_reception_id: row.apl_reception_id,
      payee_account: row.payee_account,
      related_order_ids: row.related_order_ids,
      amount: row.amount,
      symbol: row.symbol,
      purpose: row.purpose,
      status: row.status,
      confirmed_at: row.confirmed_at,
      payment_reference: row.payment_reference,
      bank_statement_ref: row.bank_statement_ref,
      blocked_reason: row.blocked_reason,
      payout_tx_hash: row.payout_tx_hash,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
