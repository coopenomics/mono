import { Resolver, Subscription, ObjectType, Field } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';

export const SOVIET_EVENTS = {
  DATA_CHANGED: 'sovietDataChanged',
};

@ObjectType('SovietDataChange')
export class SovietDataChangeDTO {
  @Field(() => String)
  entity!: string;

  @Field(() => String)
  action!: string;
}

@Resolver()
export class MeetSubscriptionResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  @Subscription(() => SovietDataChangeDTO, {
    name: 'sovietDataChanged',
    description: 'Уведомление об изменениях собраний, решений, повестки',
  })
  sovietDataChanged() {
    return this.pubSub.asyncIterableIterator(SOVIET_EVENTS.DATA_CHANGED);
  }
}
