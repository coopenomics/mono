import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsInt } from 'class-validator';

@InputType('CoopstockInput')
export class CoopstockInputDTO {
  @Field(() => String)
  @IsString()
  braname!: string;

  @Field(() => String)
  @IsString()
  hash!: string;

  @Field(() => Int)
  @IsInt()
  units!: number;

  @Field(() => String)
  @IsString()
  unit_cost!: string;

  @Field(() => Int)
  @IsInt()
  product_lifecycle_secs!: number;

  @Field(() => Int)
  @IsInt()
  warranty_period_secs!: number;

  @Field(() => String)
  @IsString()
  membership_fee_amount!: string;

  @Field(() => String)
  @IsString()
  meta!: string;
}
