import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Направление средств программы в проект или компонент (председатель).
 * Сумма списывается со свободного остатка программы и зачисляется проекту.
 */
@InputType('CapitalAllocateFundsInput')
export class AllocateFundsInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор проекта или компонента.' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => String, { description: 'Сумма направляемых средств (asset, eg "10000.0000 RUB").' })
  @IsNotEmpty()
  @IsString()
  amount!: string;
}
