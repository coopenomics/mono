import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';

@InputType('MarketplaceListPendingOffersInput')
export class MarketplaceListPendingOffersInputDTO extends PaginationInputDTO {}

@InputType('MarketplaceApproveOfferInput')
export class MarketplaceApproveOfferInputDTO {
  @Field(() => String)
  @IsString()
  public offer_id!: string;
}

@InputType('MarketplaceRejectOfferInput')
export class MarketplaceRejectOfferInputDTO {
  @Field(() => String)
  @IsString()
  public offer_id!: string;

  @Field(() => String, { description: 'Причина отказа (≤1000)' })
  @IsNotEmpty()
  @MaxLength(1000)
  public reason!: string;
}

@ObjectType('MarketplaceModerationLogEntry')
export class MarketplaceModerationLogEntryDTO {
  @Field(() => String) public readonly id!: string;
  @Field(() => String) public readonly offer_id!: string;
  @Field(() => String, { description: 'approve | reject' })
  public readonly action!: string;
  @Field(() => String) public readonly by_account!: string;
  @Field(() => String, { nullable: true }) public readonly reason!: string | null;
  @Field(() => Date) public readonly created_at!: Date;

  constructor(init: {
    id: string;
    offer_id: string;
    action: string;
    by_account: string;
    reason: string | null;
    created_at: Date;
  }) {
    Object.assign(this, init);
  }
}
