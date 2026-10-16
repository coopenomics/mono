import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
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

@ObjectType('SelectProviderTariffResult', { description: 'Выбор тарифа подключения принят провайдером' })
export class SelectProviderTariffResultDTO {
  @Field(() => String, { description: 'Код выбранного тарифа' })
  tariff_code!: string;

  @Field(() => ProviderBillingPeriod, { description: 'Период оплаты' })
  billing_period!: ProviderBillingPeriod;
}
