import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { Client } from '@coopenomics/provider-client';

/**
 * Тип для подписки провайдера
 * Получается из API через subscriptionControllerGetSubscriptionsByUsername
 */
export type ProviderSubscriptionType = Awaited<
  ReturnType<typeof Client.SubscriptionsService.subscriptionControllerGetSubscriptionsByUsername>
>[0] & {
  specific_data?: Record<string, any> | null;
};

@ObjectType('ProviderSubscription')
export class ProviderSubscriptionDTO {
  @Field(() => Number, { description: 'ID подписки' })
  id: number;

  @Field(() => Number, { description: 'ID подписчика' })
  subscriber_id: number;

  @Field(() => String, { description: 'Имя пользователя подписчика' })
  subscriber_username: string;

  @Field(() => Number, { description: 'ID типа подписки' })
  subscription_type_id: number;

  @Field(() => String, { description: 'Название типа подписки' })
  subscription_type_name: string;

  @Field(() => String, { nullable: true, description: 'Описание типа подписки' })
  subscription_type_description?: string;

  @Field(() => Number, { description: 'Цена подписки' })
  price: number;

  @Field(() => Number, { description: 'Период подписки в днях' })
  period_days: number;

  @Field(() => String, { nullable: true, description: 'Имя пользователя инстанса' })
  instance_username: string | null;

  @Field(() => Number, {
    nullable: true,
    description: 'Конфигурация сервера, на которой работает подписка хостинга',
  })
  instance_type_id?: number | null;

  @Field(() => String, { description: 'Статус подписки' })
  status: string;

  @Field(() => String, { description: 'Дата начала подписки' })
  started_at: string;

  @Field(() => String, { description: 'Дата истечения подписки' })
  expires_at: string;

  @Field(() => String, { nullable: true, description: 'Дата следующего платежа' })
  next_payment_due: string | null;

  @Field(() => Boolean, { description: 'Пробный период' })
  is_trial: boolean;

  @Field(() => String, { description: 'Дата создания' })
  created_at: string;

  @Field(() => String, { description: 'Дата обновления' })
  updated_at: string;

  // Дополнительные поля для хостинг подписки (id=1)
  @Field(() => Boolean, { nullable: true, description: 'Валидность домена' })
  domain_valid?: boolean;

  @Field(() => Number, { nullable: true, description: 'Прогресс установки' })
  installation_progress?: number;

  @Field(() => String, { nullable: true, description: 'Статус инстанса' })
  instance_status?: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Специфичные данные подписки' })
  specific_data?: Record<string, any> | null;

  // Epic 13 v5.1 — пакетная модель подписки. Эти поля нужны desktop'у
  // (`SubscriptionsCard.isPackage`, `ResourceMonitorPage`), чтобы отличать
  // time-подписку от package-подписки и показывать расход месяца. Месячного
  // потолка среди них больше нет (@ant 2026-08-26): расход ограничивает баланс
  // кошелька членских взносов — списать больше, чем на нём есть, нельзя.
  @Field(() => String, { nullable: true, description: 'Тип подписки: time или package' })
  kind?: string | null;

  @Field(() => Number, { nullable: true, description: 'Сумма RUB, докупленная в текущем месячном периоде' })
  packages_current_period_amount?: number | null;

  constructor(subscription: ProviderSubscriptionType) {
    this.id = subscription.id;
    this.subscriber_id = subscription.subscriber_id;
    this.subscriber_username = subscription.subscriber_username;
    this.subscription_type_id = subscription.subscription_type_id;
    this.subscription_type_name = subscription.subscription_type_name;
    this.subscription_type_description = subscription.subscription_type_description;
    this.price = subscription.price;
    this.period_days = subscription.period_days;
    this.instance_username = typeof subscription.instance_username === 'string' ? subscription.instance_username : null;
    this.status = subscription.status;
    this.started_at = subscription.started_at;
    this.expires_at = subscription.expires_at;
    this.next_payment_due = typeof subscription.next_payment_due === 'string' ? subscription.next_payment_due : null;
    this.is_trial = subscription.is_trial;
    this.created_at = subscription.created_at;
    this.updated_at = subscription.updated_at;
    this.specific_data = subscription.specific_data;

    // Epic 13 v5.1: пакетные поля приходят опциональными от provider'а
    // (старые time-подписки оставляют их null/undefined).
    const sub = subscription as ProviderSubscriptionType & {
      // instance_type_id провайдер отдаёт, но опубликованный provider-client
      // его ещё не описывает — читаем тем же расширением типа, что и пакетные
      // поля. Рабочему столу он нужен, чтобы назвать текущий тариф сервера
      // словом («Мощный»), а не оставлять кооператив гадать по цене.
      instance_type_id?: number | null;
      kind?: string | null;
      packages_current_period_amount?: number | string | null;
    };
    this.instance_type_id = typeof sub.instance_type_id === 'number' ? sub.instance_type_id : null;
    this.kind = sub.kind ?? null;
    this.packages_current_period_amount =
      sub.packages_current_period_amount != null ? Number(sub.packages_current_period_amount) : null;

    // Для хостинг подписки (id=1) добавляем данные инстанса из specific_data
    if (subscription.subscription_type_id === 1 && subscription.specific_data) {
      this.domain_valid = subscription.specific_data.is_valid;
      this.installation_progress = subscription.specific_data.progress;
    }
  }
}
