import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';
import type { SetPlanDomainInput } from '../../../domain/actions/set-plan-domain-input.interface';

/**
 * GraphQL DTO для установки плана проекта CAPITAL контракта
 */
@InputType('SetPlanInput')
export class SetPlanInputDTO implements SetPlanDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.setPlanInput.coopname.required') })
  @IsString({ message: validationMessage('capital.setPlanInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя мастера проекта' })
  @IsNotEmpty({ message: validationMessage('capital.setPlanInput.master.required') })
  @IsString({ message: validationMessage('capital.setPlanInput.master.string') })
  master!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.setPlanInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.setPlanInput.projectHash.string') })
  project_hash!: string;

  @Field(() => Number, { description: 'Плановое количество часов создателей' })
  @IsNumber({}, { message: validationMessage('capital.setPlanInput.planCreatorsHours.number') })
  @Min(0, { message: validationMessage('capital.setPlanInput.planCreatorsHours.min') })
  plan_creators_hours!: number;

  @Field(() => String, { description: 'Плановые расходы' })
  @IsNotEmpty({ message: validationMessage('capital.setPlanInput.planExpenses.required') })
  @IsString({ message: validationMessage('capital.setPlanInput.planExpenses.string') })
  plan_expenses!: string;

  @Field(() => String, { description: 'Стоимость часа работы' })
  @IsNotEmpty({ message: validationMessage('capital.setPlanInput.planHourCost.required') })
  @IsString({ message: validationMessage('capital.setPlanInput.planHourCost.string') })
  plan_hour_cost!: string;
}
