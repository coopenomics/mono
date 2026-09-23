import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';
import type { SetPlanDomainInput } from '../../../domain/actions/set-plan-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для установки плана проекта CAPITAL контракта
 */
@InputType('SetPlanInput')
export class SetPlanInputDTO implements SetPlanDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.setPlanInput.coopname.required') })
  @IsString({ message: t('capital.setPlanInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя мастера проекта' })
  @IsNotEmpty({ message: t('capital.setPlanInput.master.required') })
  @IsString({ message: t('capital.setPlanInput.master.string') })
  master!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.setPlanInput.projectHash.required') })
  @IsString({ message: t('capital.setPlanInput.projectHash.string') })
  project_hash!: string;

  @Field(() => Number, { description: 'Плановое количество часов создателей' })
  @IsNumber({}, { message: t('capital.setPlanInput.planCreatorsHours.number') })
  @Min(0, { message: t('capital.setPlanInput.planCreatorsHours.min') })
  plan_creators_hours!: number;

  @Field(() => String, { description: 'Плановые расходы' })
  @IsNotEmpty({ message: t('capital.setPlanInput.planExpenses.required') })
  @IsString({ message: t('capital.setPlanInput.planExpenses.string') })
  plan_expenses!: string;

  @Field(() => String, { description: 'Стоимость часа работы' })
  @IsNotEmpty({ message: t('capital.setPlanInput.planHourCost.required') })
  @IsString({ message: t('capital.setPlanInput.planHourCost.string') })
  plan_hour_cost!: string;
}
