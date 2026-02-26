import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';
import type { SetPlanDomainInput } from '../../../domain/actions/set-plan-domain-input.interface';

/**
 * GraphQL DTO для установки плана проекта CAPITAL контракта
 */
@InputType('SetPlanInput')
export class SetPlanInputDTO implements SetPlanDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя мастера проекта' })
  @IsNotEmpty({ message: 'Имя мастера проекта не должно быть пустым' })
  @IsString({ message: 'Имя мастера проекта должно быть строкой' })
  master!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => Number, { description: 'Плановое количество часов создателей' })
  @IsNumber({}, { message: 'Плановое количество часов должно быть числом' })
  @Min(0, { message: 'Плановое количество часов не может быть отрицательным' })
  plan_creators_hours!: number;

  @Field(() => String, { description: 'Плановые расходы' })
  @IsNotEmpty({ message: 'Плановые расходы не должны быть пустыми' })
  @IsString({ message: 'Плановые расходы должны быть строкой' })
  plan_expenses!: string;

  @Field(() => String, { description: 'Стоимость часа работы' })
  @IsNotEmpty({ message: 'Стоимость часа работы не должна быть пустой' })
  @IsString({ message: 'Стоимость часа работы должна быть строкой' })
  plan_hour_cost!: string;
}
