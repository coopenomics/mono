import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

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
}
