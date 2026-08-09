import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { PaginationInputDTO } from '@coopenomics/extension-kit';

@InputType('MarketplaceListPendingOffersInput')
export class MarketplaceListPendingOffersInputDTO extends PaginationInputDTO {}

@InputType('MarketplaceApproveOfferInput')
export class MarketplaceApproveOfferInputDTO {
  @Field(() => String)
  @IsString()
  public offer_id!: string;

  @Field(() => Int, {
    description:
      'Гарантийный срок возврата в днях, устанавливаемый модератором при ' +
      'одобрении. В течение этого срока пайщик может вернуть имущество. ' +
      '0 — возврат по этому предложению недоступен.',
  })
  @IsInt()
  @Min(0)
  public warranty_days!: number;
}

@InputType('MarketplaceSetOfferWarrantyInput')
export class MarketplaceSetOfferWarrantyInputDTO {
  @Field(() => String)
  @IsString()
  public offer_id!: string;

  @Field(() => Int, {
    description: 'Новый гарантийный срок возврата в днях (окно возврата имущества).',
  })
  @IsInt()
  @Min(0)
  public warranty_days!: number;
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
