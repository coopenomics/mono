import { Inject, Injectable } from '@nestjs/common';
import type { PubSub } from 'graphql-subscriptions';
import type { IRealtimeChannelPort } from '@coopenomics/innercoop';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';

/**
 * Реализация `IRealtimeChannelPort` поверх шины подписок ядра.
 *
 * Расширение получает две операции и не знает, что под ними: сейчас
 * внутрипроцессная шина, при переходе на несколько процессов — брокер, и
 * заменится только этот адаптер.
 */
@Injectable()
export class RealtimeChannelInnercoopAdapter implements IRealtimeChannelPort {
  constructor(
    @Inject(PUB_SUB)
    private readonly pubSub: PubSub
  ) {}

  async publish(trigger: string, payload: Record<string, any>): Promise<void> {
    return this.pubSub.publish(trigger, payload);
  }

  asyncIterator<T = any>(trigger: string | string[]): AsyncIterator<T> {
    return this.pubSub.asyncIterator<T>(trigger);
  }
}
