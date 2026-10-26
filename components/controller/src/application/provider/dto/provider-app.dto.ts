import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsString, Matches } from 'class-validator';
import { InnerAppSubscriptionStatus } from '@coopenomics/innercoop';

registerEnumType(InnerAppSubscriptionStatus, {
  name: 'ProviderAppSubscriptionStatus',
  description: 'Состояние подписки на приложение у провайдера подключения',
});

@ObjectType('ProviderAppSubscription', { description: 'Подписка кооператива на приложение каталога' })
export class ProviderAppSubscriptionDTO {
  @Field(() => InnerAppSubscriptionStatus, { description: 'Состояние подписки' })
  status!: InnerAppSubscriptionStatus;

  @Field(() => Float, { description: 'Цена за период, ₽ — зафиксирована при оформлении' })
  amount_per_period!: number;

  @Field(() => String, { description: 'Начало подписки' })
  started_at!: string;

  @Field(() => String, { description: 'Оплачено по' })
  expires_at!: string;

  @Field(() => Boolean, { description: 'Идёт пробный срок: до его конца оплата не списывается' })
  is_trial!: boolean;

  @Field(() => String, { nullable: true, description: 'Конец пробного срока; пусто — подписка платная' })
  trial_ends_at!: string | null;

  @Field(() => String, { nullable: true, description: 'Ближайшее списание с кошелька членских взносов' })
  next_payment_due!: string | null;
}

@ObjectType('ProviderApp', { description: 'Приложение каталога, которое кооператив может подключить' })
export class ProviderAppDTO {
  @Field(() => String, { description: 'Пакет каталога, например @voskhod/demoapp' })
  package_id!: string;

  @Field(() => String, { description: 'Название приложения' })
  title!: string;

  @Field(() => Float, { description: 'Цена за период, ₽' })
  price!: number;

  @Field(() => Int, { description: 'Период оплаты, дней' })
  period_days!: number;

  @Field(() => Int, { description: 'Пробный срок из публикации пакета, дней; 0 — оплата с первого дня' })
  trial_days!: number;

  @Field(() => ProviderAppSubscriptionDTO, {
    nullable: true,
    description: 'Действующая подписка кооператива; пусто — приложение не подключено',
  })
  subscription!: ProviderAppSubscriptionDTO | null;
}

@InputType('ProviderAppInput')
export class ProviderAppInputDTO {
  @Field(() => String, { description: 'Пакет каталога, например @voskhod/demoapp' })
  @IsString()
  @Matches(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/)
  package_id!: string;
}
