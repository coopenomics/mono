import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Возврат ранее направленных средств из компонента в программу (председатель).
 * Сумма списывается с бюджета компонента и возвращается в свободный остаток.
 */
@InputType('CapitalDeallocateFundsInput')
export class DeallocateFundsInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор проекта или компонента.' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => String, { description: 'Сумма возвращаемых средств (asset, eg "10000.0000 RUB").' })
  @IsNotEmpty()
  @IsString()
  amount!: string;
}
