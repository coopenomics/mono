import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { InnerAppSubscriptionStatus } from '@coopenomics/innercoop';

/**
 * Подписки и счёт узла у провайдера подключения — только для показа.
 * Пополнение кошелька и смена тарифа остаются на столе пайщика у оператора.
 */
@ObjectType('AppsNodeSubscription', { description: 'Подписка кооператива у провайдера подключения' })
export class AppsNodeSubscriptionDTO {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { description: 'Название подписки' })
  name!: string;

  @Field(() => String, { nullable: true, description: 'Код типа: hosting, docflow, catalog:@scope/name' })
  code!: string | null;

  @Field(() => String, { nullable: true, description: 'time — повременная, package — пакетная' })
  kind!: string | null;

  @Field(() => String, { nullable: true, description: 'Пакет каталога, если подписка на приложение' })
  packageId!: string | null;

  @Field(() => InnerAppSubscriptionStatus, { description: 'Состояние подписки' })
  status!: InnerAppSubscriptionStatus;

  @Field(() => Boolean, { description: 'Идёт пробный срок' })
  isTrial!: boolean;

  @Field(() => Float, { description: 'Цена за период, ₽' })
  price!: number;

  @Field(() => Int, { description: 'Период оплаты, дней' })
  periodDays!: number;

  @Field(() => String)
  startedAt!: string;

  @Field(() => String, { description: 'Оплачено по' })
  expiresAt!: string;

  @Field(() => String, { nullable: true, description: 'Ближайшее списание' })
  nextPaymentDue!: string | null;
}

@ObjectType('AppsNodeWallet', { description: 'Кошелёк кооператива у оператора, из которого списываются подписки' })
export class AppsNodeWalletDTO {
  @Field(() => String, { description: 'Остаток членских взносов на оплату подписок, с символом' })
  membershipAvailable!: string;

  @Field(() => String, { nullable: true, description: 'Остаток AXON кооператива, с символом' })
  axonAvailable!: string | null;
}

@ObjectType('AppsNodeBilling', { description: 'Подписки, счёт и кошелёк кооператива у провайдера подключения' })
export class AppsNodeBillingDTO {
  @Field(() => Boolean, { description: 'Узел связан с провайдером подключения' })
  available!: boolean;

  @Field(() => String, { nullable: true, description: 'Имя аккаунта оператора, у которого ведётся кошелёк' })
  operator!: string | null;

  @Field(() => String, { nullable: true, description: 'Адрес сайта оператора: на нём кооператив пополняет кошелёк и меняет тариф' })
  operatorSite!: string | null;

  @Field(() => [AppsNodeSubscriptionDTO], { description: 'Подписки кооператива, без отменённых' })
  subscriptions!: AppsNodeSubscriptionDTO[];

  @Field(() => Float, { description: 'Сумма всех действующих подписок за месяц, ₽' })
  monthlyTotal!: number;

  @Field(() => Float, { description: 'К оплате сейчас: позиции с наступившим сроком, ₽' })
  dueAmount!: number;

  @Field(() => String, { nullable: true, description: 'Ближайшее списание' })
  nextPaymentDue!: string | null;

  @Field(() => AppsNodeWalletDTO, { nullable: true, description: 'Кошелёк у оператора; пусто — узел не прочитал цепь' })
  wallet!: AppsNodeWalletDTO | null;
}
