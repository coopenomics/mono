import { ObjectType, Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsArray } from 'class-validator';
import { LeadRequestPolicy, PublishAccessPolicy } from '../../domain/entities/marketplace-settings.entity';

registerEnumType(LeadRequestPolicy, { name: 'LeadRequestPolicy' });
registerEnumType(PublishAccessPolicy, { name: 'PublishAccessPolicy' });

@InputType('UpdateMarketplaceSettingsInput')
export class UpdateMarketplaceSettingsInputDTO {
  @Field(() => LeadRequestPolicy, { nullable: true })
  @IsOptional()
  @IsEnum(LeadRequestPolicy)
  lead_request_policy?: LeadRequestPolicy;

  @Field(() => PublishAccessPolicy, { nullable: true })
  @IsOptional()
  @IsEnum(PublishAccessPolicy)
  publish_access_policy?: PublishAccessPolicy;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  publish_whitelist?: string[];

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  moderation_required?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  cycles_enabled?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  max_cycle_days?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  external_delivery_enabled?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  internal_delivery_enabled?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  allowed_category_ids?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  min_unit_cost?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  max_unit_cost?: string;
}

@ObjectType('MarketplaceSettings')
export class MarketplaceSettingsDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => LeadRequestPolicy)
  lead_request_policy!: LeadRequestPolicy;

  @Field(() => PublishAccessPolicy)
  publish_access_policy!: PublishAccessPolicy;

  @Field(() => [String])
  publish_whitelist!: string[];

  @Field(() => Boolean)
  moderation_required!: boolean;

  @Field(() => Boolean)
  cycles_enabled!: boolean;

  @Field(() => Int)
  max_cycle_days!: number;

  @Field(() => Boolean)
  external_delivery_enabled!: boolean;

  @Field(() => Boolean)
  internal_delivery_enabled!: boolean;

  @Field(() => [String])
  allowed_category_ids!: string[];

  @Field(() => String, { nullable: true })
  min_unit_cost?: string;

  @Field(() => String, { nullable: true })
  max_unit_cost?: string;
}
