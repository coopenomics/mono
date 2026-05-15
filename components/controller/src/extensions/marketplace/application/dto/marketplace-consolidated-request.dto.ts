import { Field, Int, ObjectType } from '@nestjs/graphql';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';

@ObjectType('MarketplaceConsolidatedRequest')
export class MarketplaceConsolidatedRequestDTO {
  @Field(() => String) public readonly id!: string;
  @Field(() => String) public readonly coopname!: string;
  @Field(() => String) public readonly offer_id!: string;
  @Field(() => String) public readonly supplier_account!: string;
  @Field(() => String, { description: 'time_based | volume_based | open_subscription | individual' })
  public readonly cycle_type!: string;

  @Field(() => Int) public readonly total_quantity!: number;
  @Field(() => String, { description: 'Сумма заявки (numeric как string).' })
  public readonly total_amount!: string;

  @Field(() => String, {
    description:
      'PENDING_SUPPLIER_ACCEPT | ACCEPTED | DECLINED_BY_SUPPLIER | EXPIRED_NO_RESPONSE | EXPIRED_NO_THRESHOLD | EXPIRED_NO_VOLUME',
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
