import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { ProviderBillingPeriod } from './select-provider-tariff.dto';

/**
 * Epic 28 (форм-фактор §7): каталог витрины подключения — прокси живого
 * GET /v1/subscription-types провайдера. Наружу провайдер отдаёт только
 * отпускные цены; закупка и наценка в ответе отсутствуют by design.
 */
@ObjectType('ProviderCatalogSubscriptionType', {
  description: 'Тип подписки (услуга) из каталога провайдера',
})
export class ProviderCatalogSubscriptionTypeDTO {
  @Field(() => Int, { description: 'ID типа подписки у провайдера' })
  id!: number;

  @Field(() => String, { nullable: true, description: 'Машинный код услуги (slug)' })
  code!: string | null;

  @Field(() => String, { description: 'Название услуги' })
  name!: string;

  @Field(() => String, { description: 'Описание услуги' })
  description!: string;

  @Field(() => Float, { description: 'Цена, ₽ за период' })
  price!: number;

  @Field(() => Int, { description: 'Период, дней' })
  period_days!: number;

  @Field(() => Boolean, { description: 'Обязательная услуга (заводится каждому кооперативу)' })
  is_mandatory!: boolean;

  @Field(() => Int, { description: 'Пробный период, дней (0 — без триала)' })
  trial_days!: number;

  @Field(() => String, { description: 'Модель тарификации: time | package' })
  kind!: string;

  @Field(() => [Int], { description: 'Лист зависимостей: id типов-пререквизитов' })
  depends_on!: number[];

  @Field(() => Boolean, { description: 'Разовая позиция без автопродления' })
  is_one_time!: boolean;
}

@ObjectType('ProviderCatalogServerOption', {
  description: 'Конфигурация сервера на выбор (блок «Сервер» витрины подключения)',
})
export class ProviderCatalogServerOptionDTO {
  @Field(() => Int, { description: 'ID типа инстанса в каталоге провайдера' })
  instance_type_id!: number;

  @Field(() => Int, { description: 'Тип подписки-«ворота», через который поставляется конфигурация' })
  subscription_type_id!: number;

  @Field(() => String, { description: 'Название конфигурации' })
  name!: string;

  @Field(() => String, { description: 'Описание' })
  description!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Конфигурация сервера: cpu, ram_gb, disk, label',
  })
  specs!: Record<string, unknown> | null;

  @Field(() => Float, { description: 'Отпускная цена, ₽/мес (она же цена после триала)' })
  price!: number;

  @Field(() => Int, { description: 'Пробный период, дней (0 ₽ на этот срок)' })
  trial_days!: number;
}

@ObjectType('ProviderTariffServer', { description: 'Сервер тарифа: конфигурация и цена строки' })
export class ProviderTariffServerDTO {
  @Field(() => Int, { description: 'Ядер процессора' })
  cpu!: number;

  @Field(() => Int, { description: 'Оперативная память, ГБ' })
  ram_gb!: number;

  @Field(() => Float, { description: 'Цена строки «Сервер», ₽ в месяц' })
  price!: number;
}

@ObjectType('ProviderTariffSupport', { description: 'Поддержка платформы в тарифе' })
export class ProviderTariffSupportDTO {
  @Field(() => Float, { description: 'Цена строки «Поддержка платформы», ₽ в месяц' })
  price!: number;

  @Field(() => String, { description: 'Срок ответа поддержки' })
  response!: string;
}

@ObjectType('ProviderTariff', {
  description: 'Тариф подключения: сервер, поддержка, приложение на выбор и документооборот по фиксированной цене',
})
export class ProviderTariffDTO {
  @Field(() => String, { description: 'Код тарифа' })
  code!: string;

  @Field(() => String, { description: 'Название тарифа' })
  name!: string;

  @Field(() => Int, { description: 'Предел числа пайщиков' })
  members_limit!: number;

  @Field(() => ProviderTariffServerDTO, { description: 'Сервер' })
  server!: ProviderTariffServerDTO;

  @Field(() => ProviderTariffSupportDTO, { description: 'Поддержка платформы' })
  support!: ProviderTariffSupportDTO;

  @Field(() => Float, { description: 'Цена приложения на выбор с его поддержкой, ₽ в месяц' })
  app_price!: number;

  @Field(() => Float, { description: 'Цена пакета документооборота, ₽' })
  docflow_price!: number;

  @Field(() => Float, { description: 'Цена тарифа в месяц, ₽' })
  monthly_total!: number;

  @Field(() => Float, { nullable: true, description: 'Цена тарифа за год со скидкой, ₽; пусто — годовая оплата недоступна' })
  annual_total!: number | null;
}

@ObjectType('ProviderAnnualBilling', { description: 'Годовая оплата тарифа' })
export class ProviderAnnualBillingDTO {
  @Field(() => Boolean, { description: 'Годовая оплата доступна' })
  enabled!: boolean;

  @Field(() => Float, { description: 'Скидка за год, %' })
  discount_percent!: number;
}

@ObjectType('ProviderCurrentTariff', { description: 'Тариф, который действует у кооператива' })
export class ProviderCurrentTariffDTO {
  @Field(() => String, { description: 'Код тарифа' })
  code!: string;

  @Field(() => ProviderBillingPeriod, { description: 'Период оплаты' })
  billing_period!: ProviderBillingPeriod;
}

@ObjectType('ProviderConnectionCatalog', {
  description: 'Каталог витрины подключения: услуги и конфигурации сервера',
})
export class ProviderConnectionCatalogDTO {
  @Field(() => [ProviderCatalogSubscriptionTypeDTO], {
    description: 'Доступные кооперативу услуги (лист зависимостей учтён провайдером)',
  })
  types!: ProviderCatalogSubscriptionTypeDTO[];

  @Field(() => [ProviderCatalogServerOptionDTO], {
    description: 'Конфигурации сервера на выбор',
  })
  server_options!: ProviderCatalogServerOptionDTO[];

  @Field(() => [ProviderTariffDTO], { description: 'Тарифная сетка подключения' })
  tariffs!: ProviderTariffDTO[];

  @Field(() => ProviderAnnualBillingDTO, { description: 'Годовая оплата тарифа' })
  annual_billing!: ProviderAnnualBillingDTO;

  @Field(() => ProviderCurrentTariffDTO, {
    nullable: true,
    description: 'Тариф кооператива из запроса; пусто — тариф не выбран или кооператив чужой',
  })
  current_tariff!: ProviderCurrentTariffDTO | null;
}
