import { ObjectType, Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { IsString, IsInt, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ProductCardType, ProductCardStatus, DeliveryType, ContributionType } from '../../domain/entities/product-card.entity';

registerEnumType(ProductCardType, { name: 'ProductCardType' });
registerEnumType(ProductCardStatus, { name: 'ProductCardStatus' });
registerEnumType(DeliveryType, { name: 'DeliveryType' });
registerEnumType(ContributionType, { name: 'ContributionType' });

@InputType('CreateProductCardInput')
export class CreateProductCardInputDTO {
  @Field(() => ProductCardType)
  @IsEnum(ProductCardType)
  type!: ProductCardType;

  @Field(() => String)
  @IsString()
  title!: string;

  @Field(() => String)
  @IsString()
  description!: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  images?: string[];

  @Field(() => String)
  @IsString()
  unit_cost!: string;

  @Field(() => Int)
  @IsInt()
  units!: number;

  @Field(() => DeliveryType)
  @IsEnum(DeliveryType)
  delivery_type!: DeliveryType;

  @Field(() => ContributionType)
  @IsEnum(ContributionType)
  contribution_type!: ContributionType;

  @Field(() => Int)
  @IsInt()
  product_lifecycle_secs!: number;

  @Field(() => Int)
  @IsInt()
  warranty_period_secs!: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  membership_fee_amount?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  cancellation_fee_amount?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  category_id?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  min_units?: number;
}

@ObjectType('ProductCard')
export class ProductCardDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String)
  username!: string;

  @Field(() => ProductCardType)
  type!: ProductCardType;

  @Field(() => ProductCardStatus)
  status!: ProductCardStatus;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;

  @Field(() => [String])
  images!: string[];

  @Field(() => String)
  unit_cost!: string;

  @Field(() => Int)
  units!: number;

  @Field(() => DeliveryType)
  delivery_type!: DeliveryType;

  @Field(() => ContributionType)
  contribution_type!: ContributionType;

  @Field(() => Int)
  product_lifecycle_secs!: number;

  @Field(() => Int)
  warranty_period_secs!: number;

  @Field(() => String, { nullable: true })
  membership_fee_amount?: string;

  @Field(() => String, { nullable: true })
  cancellation_fee_amount?: string;

  @Field(() => String, { nullable: true })
  category_id?: string;

  @Field(() => String, { nullable: true })
  braname?: string;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}
