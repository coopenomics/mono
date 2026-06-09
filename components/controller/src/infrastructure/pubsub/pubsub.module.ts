import { Global, Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

/**
 * DI-токен единственного in-memory PubSub приложения.
 *
 * Why in-memory (не graphql-redis-subscriptions): один controller обслуживает
 * один кооператив (config.coopname) одним процессом — горизонтального шардинга
 * подписчиков по нескольким инстансам в MVP нет, поэтому межпроцессный брокер
 * избыточен. При переходе на multi-instance замена — только эта фабрика
 * (RedisPubSub с тем же интерфейсом asyncIterator/publish), потребители не
 * меняются.
 */
export const PUB_SUB = Symbol('PUB_SUB');

@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      useFactory: () => new PubSub(),
    },
  ],
  exports: [PUB_SUB],
})
export class PubSubModule {}
