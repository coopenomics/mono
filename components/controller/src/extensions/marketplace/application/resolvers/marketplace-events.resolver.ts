import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Args, Resolver, Subscription } from '@nestjs/graphql';
import logger from '~/config/logger';
import { CurrentUser, platformSettings } from '@coopenomics/extension-kit';
import {
  MarketplaceEventPayload,
  MarketplaceEventUnion,
} from '../dto/marketplace-event.dto';
import { MarketplaceEventsInputDTO } from '../dto/marketplace-events-input.dto';
import {
  marketplaceBoardTopic,
  marketplaceCatalogTopic,
  marketplaceMemberTopic,
  marketplaceModerationTopic,
  marketplaceStaffTopic,
} from '../realtime/marketplace-realtime.topics';
import { BRANCH_PORT, type IBranchPort,
  REALTIME_CHANNEL_PORT,
  type IRealtimeChannelPort,
  USER_DIRECTORY_PORT,
  type IUserDirectoryPort,
} from '@coopenomics/innercoop';

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
    @Inject(REALTIME_CHANNEL_PORT) private readonly pubSub: IRealtimeChannelPort,
    @Inject(USER_DIRECTORY_PORT) private readonly userRepository: IUserDirectoryPort,
    @Inject(BRANCH_PORT) private readonly branchPort: IBranchPort
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
    if (input.coopname !== platformSettings().coopname) {
      throw new ForbiddenException('Подписка доступна только в рамках своего кооператива.');
    }

    const username = user.username ?? (await this.resolveUsername(user.sub));
    const memberTopic = marketplaceMemberTopic(platformSettings().coopname, username);
    const catalogTopic = marketplaceCatalogTopic(platformSettings().coopname);
    const topics = [memberTopic, catalogTopic];
    const role = await this.resolveRole(username);
    // Служебный канал КУ: персонал участка ИЛИ председатель — у него
    // marketplace-роль admin (read:all), надзорные столы (сводка склада,
    // списания) живут теми же операционными сигналами.
    if (role === 'chairman' || (await this.isBranchStaff(username))) {
      topics.push(marketplaceStaffTopic(platformSettings().coopname));
    }
    if (role === 'chairman') {
      topics.push(marketplaceModerationTopic(platformSettings().coopname));
    }
    // Канал совета: члены совета и председатель (повестка списаний).
    if (role === 'chairman' || role === 'member') {
      topics.push(marketplaceBoardTopic(platformSettings().coopname));
    }
    logger.info(`[mp-ws] подписка открыта: ${topics.join(' + ')}`);
    return this.pubSub.asyncIterator<MarketplaceEventPayload>(topics);
  }

  /**
   * Core-роль аккаунта (user/member/chairman) — определяет служебные каналы:
   * chairman → staff + moderation + board, member → board (та же логика, что
   * в `mapCoreRolesToMarketplaceRoles`). Роль читаем из записи пользователя в
   * PG, а не из ws-контекста: graphql-ws кладёт в контекст только `sub`.
   * Ошибка проверки деградирует в «обычный пайщик» — служебные столы добирают
   * состояние resync'ом.
   */
  private async resolveRole(username: string): Promise<string | null> {
    try {
      const record = await this.userRepository.findByUsername(username);
      return record?.role ?? null;
    } catch (err: any) {
      logger.warn(
        `[mp-ws] не удалось проверить роль ${username}: ${err.message} — служебные каналы не подключены`
      );
      return null;
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
      const branches = await this.branchPort.getBranches(platformSettings().coopname);
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
    const account = await this.userRepository.findBySubject(sub);
    return account.username;
  }
}
