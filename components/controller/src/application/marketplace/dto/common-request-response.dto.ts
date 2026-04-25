import { Field, Int, Float, ObjectType } from '@nestjs/graphql';
import { IsInt, IsNumber, IsString, Matches } from 'class-validator';
import { ASSET_REGEX } from '~/types/shared';

@ObjectType('CommonRequestResponse')
export class CommonRequestResponseDTO {
  @Field()
  @IsString()
  hash!: string;

  @Field()
  @IsString()
  title!: string;

  @Field()
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

  @Field()
  @IsString()
  currency!: string;

  @Field()
  @IsString()
  type!: string;

  @Field(() => Int)
  @IsInt()
  program_id!: number;
}
