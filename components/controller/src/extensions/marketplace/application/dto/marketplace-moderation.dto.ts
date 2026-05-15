import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, IsInt, MaxLength, Min, Max } from 'class-validator';

@InputType('MarketplaceListPendingOffersInput')
export class MarketplaceListPendingOffersInputDTO {
  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  public limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public offset?: number;
}

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
