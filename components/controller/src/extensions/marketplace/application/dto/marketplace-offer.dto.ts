import { Field, Int, ObjectType } from '@nestjs/graphql';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';

@ObjectType('MarketplaceOffer')
export class MarketplaceOfferDTO {
  @Field(() => String) public readonly id!: string;
  @Field(() => String) public readonly coopname!: string;
  @Field(() => String) public readonly supplier_account!: string;
  @Field(() => String) public readonly vitrine_id!: string;

  @Field(() => String) public readonly product_name!: string;
  @Field(() => String, { nullable: true }) public readonly description!: string | null;
  @Field(() => Int) public readonly category_id!: number;

  @Field(() => String, { description: 'Цена за единицу (numeric как string)' })
  public readonly price_per_unit!: string;

  @Field(() => String, { description: 'piece | kg | liter | pack' })
  public readonly unit_of_measure!: string;

  @Field(() => Int) public readonly quantity_available!: number;
  @Field(() => Int) public readonly quantity_blocked!: number;
  @Field(() => Int) public readonly quantity_consumed!: number;
  @Field(() => Boolean) public readonly unlimited_flag!: boolean;

  @Field(() => String, { description: 'time_based | volume_based | open_subscription | individual' })
  public readonly cycle_type!: string;
  @Field(() => Int, { nullable: true }) public readonly cycle_days!: number | null;
  @Field(() => Int, { nullable: true }) public readonly target_volume!: number | null;
  @Field(() => Int, { nullable: true }) public readonly max_wait_days!: number | null;
  @Field(() => Int, { nullable: true }) public readonly min_threshold!: number | null;
  @Field(() => Int) public readonly warranty_days!: number;

  @Field(() => String, {
    description: 'PENDING_MODERATION | ACTIVE | REJECTED | WITHDRAWN',
  })
  public readonly status!: string;

  @Field(() => String, { nullable: true }) public readonly approved_by!: string | null;
  @Field(() => Date, { nullable: true }) public readonly approved_at!: Date | null;
  @Field(() => String, { nullable: true }) public readonly rejected_by!: string | null;
  @Field(() => Date, { nullable: true }) public readonly rejected_at!: Date | null;
  @Field(() => String, { nullable: true }) public readonly reject_reason!: string | null;

  @Field(() => Date) public readonly created_at!: Date;
  @Field(() => Date) public readonly updated_at!: Date;

  constructor(init: Partial<MarketplaceOfferDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceOfferPaginationResult')
export class MarketplaceOfferPaginationResultDTO extends createPaginationResult(
  MarketplaceOfferDTO,
  'MarketplaceOffer'
) {}

@ObjectType('MarketplaceCategory')
export class MarketplaceCategoryDTO {
  @Field(() => Int) public readonly id!: number;
  @Field(() => String) public readonly display_name!: string;
  @Field(() => Int) public readonly sort_order!: number;
  @Field(() => Boolean) public readonly mvp_baseline!: boolean;

  constructor(init: {
    id: number;
    display_name: string;
    sort_order: number;
    mvp_baseline: boolean;
  }) {
    this.id = init.id;
    this.display_name = init.display_name;
    this.sort_order = init.sort_order;
    this.mvp_baseline = init.mvp_baseline;
  }
}
