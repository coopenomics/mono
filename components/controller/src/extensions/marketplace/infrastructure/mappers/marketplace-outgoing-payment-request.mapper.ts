import { Injectable } from '@nestjs/common';
import { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import type { MarketplaceOutgoingPaymentLine } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import { MarketplaceOutgoingPaymentRequestEntity } from '../entities/marketplace-outgoing-payment-request.entity';

@Injectable()
export class MarketplaceOutgoingPaymentRequestMapper {
  toDomain(
    row: MarketplaceOutgoingPaymentRequestEntity
  ): MarketplaceOutgoingPaymentRequestDomainEntity {
    return new MarketplaceOutgoingPaymentRequestDomainEntity({
      id: row.id,
      coopname: row.coopname,
      payment_hash: row.payment_hash,
      lines: MarketplaceOutgoingPaymentRequestMapper.parseLines(row.lines),
      payee_account: row.payee_account,
      amount: row.amount,
      symbol: row.symbol,
      purpose: row.purpose,
      payout_destination: row.payout_destination,
      withheld_amount: row.withheld_amount ?? '0',
      status: row.status,
      completed_at: row.completed_at,
      decline_reason: row.decline_reason,
      core_payment_id: row.core_payment_id,
      payout_tx_hash: row.payout_tx_hash,
      settled_at: row.settled_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  /** Драйвер отдаёт jsonb массивом либо строкой — читаем оба вида. */
  static parseLines(raw: unknown): MarketplaceOutgoingPaymentLine[] {
    const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    if (!Array.isArray(value)) return [];
    return value
      .filter((l): l is { order_id: unknown; order_hash: unknown } => !!l && typeof l === 'object')
      .map((l) => ({ order_id: String(l.order_id), order_hash: String(l.order_hash) }));
  }
}
