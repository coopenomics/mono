import { Resolver, Subscription, ObjectType, Field } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';

export const SYSTEM_EVENTS = {
  STATUS_CHANGED: 'systemStatusChanged',
};

@ObjectType('SystemStatusChange')
export class SystemStatusChangeDTO {
  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  message?: string;
}

@Resolver()
export class SystemSubscriptionResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  @Subscription(() => SystemStatusChangeDTO, {
    name: 'systemStatusChanged',
    description: 'Уведомление об изменении состояния системы (статус, конфигурация)',
  })
  systemStatusChanged() {
    return this.pubSub.asyncIterableIterator(SYSTEM_EVENTS.STATUS_CHANGED);
  }
}
