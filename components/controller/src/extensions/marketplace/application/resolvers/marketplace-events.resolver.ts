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
  BRANCH_BLOCKCHAIN_PORT,
  type BranchBlockchainPort,
} from '~/domain/branch/interfaces/branch-blockchain.port';
import {
  MarketplaceEventPayload,
  MarketplaceEventUnion,
} from '../dto/marketplace-event.dto';
import { MarketplaceEventsInputDTO } from '../dto/marketplace-events-input.dto';
import {
  marketplaceCatalogTopic,
  marketplaceMemberTopic,
  marketplaceModerationTopic,
  marketplaceStaffTopic,
} from '../realtime/marketplace-realtime.topics';

/**
 * Единственная подписка приложения marketplace: поток событий для пайщика.
 * Аутентификация соединения — в graphql-ws `onConnect` (см. graphql.module.ts),
 * который кладёт `sub` JWT в контекст; здесь по `sub` резолвится имя аккаунта.
 *
 * Соединение слушает топики по праву аккаунта: персональный (приватные события
 * заказчика/поставщика, выводится из токена — клиент НЕ может задать чужой),
 * широковещательный каталог кооператива (публичные события витрины — остаток,
 * новое предложение) и — только для персонала КУ (trustee/trusted хотя бы
 * одного участка) — служебный канал столов оператора (подписи у стойки).
 * Право проверяется сервером при открытии подписки, клиент топики не выбирает.
 * Аргумент `input.coopname` лишь сверяется с кооперативом инстанса.
 */
@Resolver()
@Injectable()
export class MarketplaceEventsResolver {
  constructor(
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(BRANCH_BLOCKCHAIN_PORT) private readonly branchPort: BranchBlockchainPort
  ) {}

  @Subscription(() => MarketplaceEventUnion, {
    name: 'marketplaceEvents',
    description: 'Поток событий пайщика в Столе заказов: личные и каталог.',
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
    const memberTopic = marketplaceMemberTopic(config.coopname, username);
    const catalogTopic = marketplaceCatalogTopic(config.coopname);
    const topics = [memberTopic, catalogTopic];
    if (await this.isBranchStaff(username)) {
      topics.push(marketplaceStaffTopic(config.coopname));
    }
    if (await this.isChairman(username)) {
      topics.push(marketplaceModerationTopic(config.coopname));
    }
    logger.info(`[mp-ws] подписка открыта: ${topics.join(' + ')}`);
    return this.pubSub.asyncIterator<MarketplaceEventPayload>(topics);
  }

  /**
   * Канал модерации — только председателю (core-роль chairman = marketplace
   * admin, та же логика, что в `mapCoreRolesToMarketplaceRoles`). Роль читаем
   * из записи пользователя в PG, а не из ws-контекста: graphql-ws кладёт в
   * контекст только `sub`. Ошибка проверки деградирует в «не председатель» —
   * стол модерации добирает состояние resync'ом.
   */
  private async isChairman(username: string): Promise<boolean> {
    try {
      const record = await this.userRepository.findByUsername(username);
      return record?.role === 'chairman';
    } catch (err: any) {
      logger.warn(
        `[mp-ws] не удалось проверить роль ${username}: ${err.message} — канал модерации не подключён`
      );
      return false;
    }
  }

  /**
   * Персонал КУ = председатель участка (trustee) или его доверенное лицо
   * (trusted). Branches не реплицируются в Postgres — chain RPC через port
   * (как в MarketplaceBranchOwnershipService); один вызов на открытие
   * подписки, не hot-path. Ошибка проверки деградирует в «не персонал»:
   * подписка остаётся рабочей, столы оператора добирают состояние resync'ом.
   */
  private async isBranchStaff(username: string): Promise<boolean> {
    try {
      const branches = await this.branchPort.getBranches(config.coopname);
      return branches.some(
        (b) => b.trustee === username || (b.trusted?.includes(username) ?? false)
      );
    } catch (err: any) {
      logger.warn(
        `[mp-ws] не удалось проверить персонал КУ для ${username}: ${err.message} — служебный канал не подключён`
      );
      return false;
    }
  }

  private async resolveUsername(sub: string | undefined): Promise<string> {
    if (!sub) {
      throw new ForbiddenException('Не удалось определить пайщика из токена подписки.');
    }
    const account = await resolveUserBySub(sub, this.userRepository, this.userDomainService);
    return account.username;
  }
}
