import { Field, Float, ObjectType } from '@nestjs/graphql';
import { createPaginationResult } from '@coopenomics/extension-kit';
import type { MarketplaceConsolidatedRequestDomainEntity } from '../../domain/entities/marketplace-consolidated-request.entity';

@ObjectType('MarketplaceConsolidatedRequest')
export class MarketplaceConsolidatedRequestDTO {
  @Field(() => String) public readonly id!: string;
  @Field(() => String) public readonly coopname!: string;
  @Field(() => String) public readonly offer_id!: string;
  @Field(() => String) public readonly supplier_account!: string;

  @Field(() => Float) public readonly total_quantity!: number;
  @Field(() => String, { description: 'Сумма заявки (numeric как string).' })
  public readonly total_amount!: string;

  @Field(() => String, {
    description:
      'PENDING_SUPPLIER_ACCEPT | ACCEPTED | DECLINED_BY_SUPPLIER | EXPIRED_NO_RESPONSE',
  })
  public readonly status!: string;

  @Field(() => Date) public readonly cycle_started_at!: Date;
  @Field(() => Date, { nullable: true }) public readonly cycle_ended_at!: Date | null;
  @Field(() => Date, { nullable: true }) public readonly expires_at!: Date | null;
  @Field(() => Date, { nullable: true }) public readonly accepted_at!: Date | null;
  @Field(() => Date, { nullable: true }) public readonly declined_at!: Date | null;
  @Field(() => String, { nullable: true }) public readonly decline_reason!: string | null;
  @Field(() => Date, { nullable: true }) public readonly triggered_by_supplier_at!: Date | null;

  @Field(() => Date) public readonly created_at!: Date;
  @Field(() => Date) public readonly updated_at!: Date;

  constructor(init: Partial<MarketplaceConsolidatedRequestDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceConsolidatedRequestPaginationResult')
export class MarketplaceConsolidatedRequestPaginationResultDTO extends createPaginationResult(
  MarketplaceConsolidatedRequestDTO,
  'MarketplaceConsolidatedRequest'
) {}

export function toMarketplaceConsolidatedRequestDTO(
  r: MarketplaceConsolidatedRequestDomainEntity
): MarketplaceConsolidatedRequestDTO {
  return new MarketplaceConsolidatedRequestDTO({
    id: r.id,
    coopname: r.coopname,
    offer_id: r.offer_id,
    supplier_account: r.supplier_account,
    total_quantity: r.total_quantity,
    total_amount: r.total_amount,
    status: r.status,
    cycle_started_at: r.cycle_started_at,
    cycle_ended_at: r.cycle_ended_at,
    expires_at: r.expires_at,
    accepted_at: r.accepted_at,
    declined_at: r.declined_at,
    decline_reason: r.decline_reason,
    triggered_by_supplier_at: r.triggered_by_supplier_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  });
}
