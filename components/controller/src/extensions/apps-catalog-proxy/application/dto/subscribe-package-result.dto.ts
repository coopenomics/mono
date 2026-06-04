import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Статусы результата `Mutation.subscribePackage`.
 *
 *  - `activated` — подписка ACTIVE/trial (HTTP 201), поля даты заполнены;
 *  - `alreadyActive` — у кооператива уже есть активная подписка
 *    на этот пакет (HTTP 409);
 *  - `clientNotRegistered` — кооператив не зарегистрирован в каталоге
 *    восхода (HTTP 403), сначала нужен onboarding;
 *  - `unavailable` — каталог временно недоступен (HTTP 423 KE);
 *  - `failed` — прочие ошибки.
 */
export enum SubscribePackageStatus {
  ACTIVATED = 'activated',
  ALREADY_ACTIVE = 'alreadyActive',
  CLIENT_NOT_REGISTERED = 'clientNotRegistered',
  UNAVAILABLE = 'unavailable',
  FAILED = 'failed',
}

registerEnumType(SubscribePackageStatus, {
  name: 'SubscribePackageStatus',
  description: 'Статус мутации subscribePackage',
});

export enum SubscriptionStateEnum {
  TRIAL = 'trial',
  ACTIVE = 'active',
  EXPIRED = 'expired',
}

registerEnumType(SubscriptionStateEnum, {
  name: 'SubscriptionStateEnum',
  description: 'Состояние подписки кооператива на пакет',
});

@ObjectType()
export class SubscribePackageResultDTO {
  @Field(() => SubscribePackageStatus, { description: 'Discriminator' })
  status!: SubscribePackageStatus;

  @Field(() => SubscriptionStateEnum, {
    nullable: true,
    description: 'Состояние подписки (только при status=activated)',
  })
  state?: SubscriptionStateEnum;

  @Field({
    nullable: true,
    description: 'Идентификатор пакета (только при status=activated)',
  })
  packageId?: string;

  @Field({
    nullable: true,
    description: 'Имя плана (только при status=activated)',
  })
  plan?: string;

  @Field({
    nullable: true,
    description: 'Начало периода (ISO 8601, только при status=activated)',
  })
  startAt?: string;

  @Field({
    nullable: true,
    description: 'Конец периода (ISO 8601, только при status=activated)',
  })
  endAt?: string;

  @Field({
    nullable: true,
    description:
      'Использован ли free trial (только при status=activated). ' +
      'Если true — следующая активация будет pay.',
  })
  freeTrialUsed?: boolean;

  @Field({
    nullable: true,
    description: 'Человекочитаемое сообщение об ошибке',
  })
  error?: string;
}
