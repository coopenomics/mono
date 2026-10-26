import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { InnerAppSubscriptionStatus } from '@coopenomics/innercoop';

/**
 * Подписка кооператива на приложение каталога — как её видит узел: состояние
 * у провайдера, пробный срок и ближайшее списание. Перечисление состояния
 * зарегистрировано ядром под именем `ProviderAppSubscriptionStatus`.
 */
@ObjectType('AppsCatalogSubscription', { description: 'Подписка кооператива на приложение каталога' })
export class AppsCatalogSubscriptionDTO {
  @Field(() => InnerAppSubscriptionStatus, { description: 'Состояние подписки у провайдера' })
  status!: InnerAppSubscriptionStatus;

  @Field(() => Boolean, { description: 'Идёт пробный срок: до его конца оплата не списывается' })
  isTrial!: boolean;

  @Field(() => String, { nullable: true, description: 'Конец пробного срока; пусто — подписка платная' })
  trialEndsAt!: string | null;

  @Field(() => String, { description: 'Начало подписки' })
  startedAt!: string;

  @Field(() => String, { description: 'Оплачено по' })
  expiresAt!: string;

  @Field(() => String, { nullable: true, description: 'Ближайшее списание с кошелька членских взносов у оператора' })
  nextPaymentDue!: string | null;

  @Field(() => Float, { description: 'Цена за период, ₽ — зафиксирована при оформлении' })
  amountPerPeriod!: number;
}

/**
 * Приложение каталога на витрине узла: что это, сколько стоит, подключено ли,
 * установлен ли его фронт и включено ли оно на рабочем столе. Источники —
 * каталог (список пакетов), провайдер (цена, пробный срок, подписка),
 * оркестратор (фронт в кэше) и таблица узла (переключатель).
 */
@ObjectType()
export class AppsCatalogRemotePackageDTO {
  @Field({ description: 'Идентификатор пакета (например, @voskhod/demoapp)' })
  packageId!: string;

  @Field({ description: 'Имя владельца пакета (кооператив-разработчик)' })
  publisher!: string;

  @Field(() => [String], {
    description: 'Совместимые subnet (chain_id блокчейна ЦК)',
  })
  compatibleSubnets!: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Последняя активная версия (semver). null = релизов ещё нет.',
  })
  lastActiveVersion?: string | null;

  @Field({ description: 'Название приложения' })
  title!: string;

  @Field({ description: 'Краткое описание' })
  description!: string;

  @Field(() => Float, { description: 'Стоимость подписки у провайдера подключения, ₽ в месяц' })
  rubPerMonth!: number;

  @Field(() => Int, { description: 'Пробный срок из публикации пакета, дней; 0 — оплата с первого дня' })
  trialDays!: number;

  @Field(() => AppsCatalogSubscriptionDTO, {
    nullable: true,
    description: 'Действующая подписка кооператива; пусто — приложение не подключено',
  })
  subscription!: AppsCatalogSubscriptionDTO | null;

  @Field(() => Boolean, { description: 'Фронт приложения получен оркестратором и готов к показу' })
  installed!: boolean;

  @Field(() => Boolean, { description: 'Приложение включено на рабочем столе узла' })
  enabled!: boolean;
}
