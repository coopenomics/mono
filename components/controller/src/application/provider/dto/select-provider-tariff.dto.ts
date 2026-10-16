import { Field, Float, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsString, Matches } from 'class-validator';

/** Период оплаты тарифа подключения. */
export enum ProviderBillingPeriod {
  month = 'month',
  year = 'year',
}

registerEnumType(ProviderBillingPeriod, {
  name: 'ProviderBillingPeriod',
  description: 'Период оплаты тарифа подключения',
});

@InputType('SelectProviderTariffInput')
export class SelectProviderTariffInputDTO {
  @Field(() => String, { description: 'Код тарифа из тарифной сетки провайдера' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/)
  tariff_code!: string;

  @Field(() => ProviderBillingPeriod, { description: 'Период оплаты', defaultValue: ProviderBillingPeriod.month })
  @IsEnum(ProviderBillingPeriod)
  billing_period!: ProviderBillingPeriod;
}

@ObjectType('ChangeProviderTariffResult', { description: 'Смена тарифа подключения принята провайдером' })
export class ChangeProviderTariffResultDTO {
  @Field(() => String, { description: 'Состояние переноса на сервер тарифа; none — переноса нет, сменились только цены' })
  migration_state!: string;

  @Field(() => Float, { description: 'Цена нового тарифа в месяц, ₽' })
  monthly_total!: number;

  @Field(() => Float, { nullable: true, description: 'Цена нового тарифа за год, ₽; пусто — годовая оплата недоступна' })
  annual_total!: number | null;
}

@ObjectType('SelectProviderTariffResult', { description: 'Выбор тарифа подключения принят провайдером' })
export class SelectProviderTariffResultDTO {
  @Field(() => String, { description: 'Код выбранного тарифа' })
  tariff_code!: string;

  @Field(() => ProviderBillingPeriod, { description: 'Период оплаты' })
  billing_period!: ProviderBillingPeriod;
}
