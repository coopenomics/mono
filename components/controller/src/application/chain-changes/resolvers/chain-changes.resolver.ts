import { Args, Resolver, Subscription } from '@nestjs/graphql';
import { ForbiddenException, Inject } from '@nestjs/common';
import type { PubSub } from 'graphql-subscriptions';
import { CurrentUser } from '@coopenomics/extension-kit';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import {
  ChainChangesService,
  chainChangesOwnerTopic,
  chainChangesStaffTopic,
  chainChangesTopic,
} from '~/infrastructure/blockchain/chain-changes.service';
import config from '~/config/config';
import { ChainChangeDTO, ChainChangesInputDTO } from '../dto/chain-change.dto';

@Resolver()
export class ChainChangesResolver {
  constructor(
    private readonly feed: ChainChangesService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub
  ) {}

  /**
   * Лента изменений цепи: сигнал «данные изменились, перечитай» для столов.
   * Каналы выбирает сервер по праву пайщика: таблица, открытая всем, — общий
   * канал; личная — строки самого пайщика, а персоналу (совет и назначенные
   * расширением) все строки; служебная — только персоналу. Необъявленную
   * таблицу слушать нельзя.
   */
  @Subscription(() => ChainChangeDTO, {
    name: 'chainChanges',
    description: 'Изменения данных кооператива в цепи: сигнал к дочитке. Приходит, когда изменение уже в базе узла.',
    resolve: (payload: { chainChanges: ChainChangeDTO }) => payload.chainChanges,
  })
  chainChanges(
    @CurrentUser() user: { username?: string; role?: string },
    @Args('input') input: ChainChangesInputDTO
  ): AsyncIterator<{ chainChanges: ChainChangeDTO }> {
    if (input.coopname !== config.coopname) {
      throw new ForbiddenException('Подписка доступна только в рамках своего кооператива.');
    }
    const username = user?.username;
    if (!username) {
      throw new ForbiddenException('Подписка доступна только пайщику своего кооператива.');
    }
    const requested = input.tables?.length ? input.tables : this.feed.declared();

    const topics = new Set<string>();
    for (const ref of requested) {
      const declared = this.feed.tableOf(ref.code, ref.table);
      if (!declared) {
        throw new ForbiddenException(`Таблица ${ref.code}::${ref.table} не входит в ленту изменений.`);
      }
      const staff = this.feed.isStaff(ref.code, user);
      if (declared.staff_only) {
        // Служебная таблица: пайщику вне персонала её сигналы не нужны.
        if (staff) topics.add(chainChangesStaffTopic(config.coopname, ref.code, ref.table));
      } else if (declared.owner_field) {
        topics.add(
          staff
            ? chainChangesStaffTopic(config.coopname, ref.code, ref.table)
            : chainChangesOwnerTopic(config.coopname, ref.code, ref.table, username)
        );
      } else {
        topics.add(chainChangesTopic(config.coopname, ref.code, ref.table));
      }
    }
    return this.pubSub.asyncIterator([...topics]);
  }
}
