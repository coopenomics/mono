import { Field, InputType, Int, Float } from '@nestjs/graphql';
import { IsInt, IsString, Matches } from 'class-validator';
import { ASSET_REGEX } from '~/types/shared';

@InputType('CommonRequestInput')
export class CommonRequestInputDTO {
  @Field(() => String)
  @IsString()
  hash!: string;

  @Field(() => String)
  @IsString()
  title!: string;

  @Field(() => String)
  @IsString()
  unit_of_measurement!: string;

  @Field(() => Int)
  @IsInt()
  units!: number;

  @Field(() => String)
  @IsString()
  @Matches(ASSET_REGEX, {
    message: 'Формат должен быть "10.0000 RUB" (число с четырьмя десятичными знаками + символ валюты)',
  })
  unit_cost!: string;

  @Field(() => String)
  @IsString()
  @Matches(ASSET_REGEX, {
    message: 'Формат должен быть "10.0000 RUB" (число с четырьмя десятичными знаками + символ валюты)',
  })
  total_cost!: string;

  @Field(() => String)
  @IsString()
  currency!: string;

  @Field(() => String)
  @IsString()
  type!: string;

  @Field(() => Int)
  @IsInt()
  program_id!: number;
}
