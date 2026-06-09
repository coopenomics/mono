import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Args, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import config from '~/config/config';
import logger from '~/config/logger';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { resolveUserBySub } from '~/application/auth/utils/resolve-user-by-sub';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import {
  MarketplaceEventPayload,
  MarketplaceEventUnion,
} from '../dto/marketplace-event.dto';
import { MarketplaceEventsInputDTO } from '../dto/marketplace-events-input.dto';
import { marketplaceMemberTopic } from '../realtime/marketplace-realtime.topics';

/**
 * Единственная подписка приложения marketplace: персональный поток событий
 * пайщика. Аутентификация соединения — в graphql-ws `onConnect` (см.
 * graphql.module.ts), который кладёт `sub` JWT в контекст; здесь по `sub`
 * резолвится имя аккаунта и строится приватный топик. Клиент НЕ может задать
 * чужой топик — он выводится из токена, аргумент `input.coopname` лишь
 * сверяется с кооперативом инстанса.
 */
@Resolver()
@Injectable()
export class MarketplaceEventsResolver {
  constructor(
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService
  ) {}

  @Subscription(() => MarketplaceEventUnion, {
    name: 'marketplaceEvents',
    description: 'Персональный поток событий пайщика в Столе заказов.',
    resolve: (payload: MarketplaceEventPayload) => payload,
  })
  async marketplaceEvents(
    @CurrentUser() user: { sub?: string; username?: string },
    @Args('input') input: MarketplaceEventsInputDTO
  ): Promise<AsyncIterator<MarketplaceEventPayload>> {
    if (input.coopname !== config.coopname) {
      throw new ForbiddenException('Подписка доступна только в рамках своего кооператива.');
    }

    const username = user.username ?? (await this.resolveUsername(user.sub));
    const topic = marketplaceMemberTopic(config.coopname, username);
    logger.info(`[mp-ws] подписка открыта: ${topic}`);
    return this.pubSub.asyncIterator<MarketplaceEventPayload>(topic);
  }

  private async resolveUsername(sub: string | undefined): Promise<string> {
    if (!sub) {
      throw new ForbiddenException('Не удалось определить пайщика из токена подписки.');
    }
    const account = await resolveUserBySub(sub, this.userRepository, this.userDomainService);
    return account.username;
  }
}
