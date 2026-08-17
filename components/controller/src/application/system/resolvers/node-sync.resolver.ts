import { Inject } from '@nestjs/common';
import { Query, Resolver, Subscription } from '@nestjs/graphql';
import type { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { NodeSyncStateDTO } from '../dto/node-sync-state.dto';
import { NODE_SYNC_STATE_TOPIC, NodeSyncHealthService } from '../services/node-sync-health.service';

/**
 * Состояние узла кооператива: догнал он цепь или ещё читает её.
 *
 * Запрос отвечает на первую отрисовку рабочего стола, подписка — на всё
 * остальное. Запрос открыт без авторизации намеренно: пока узел не догнал
 * цепь, войти в кабинет всё равно нельзя, и причину этого пайщик обязан
 * видеть до входа.
 */
@Resolver()
export class NodeSyncResolver {
  constructor(
    private readonly nodeSyncHealthService: NodeSyncHealthService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub
  ) {}

  @Query(() => NodeSyncStateDTO, {
    name: 'getNodeSyncState',
    nullable: true,
    description: 'Насколько узел кооператива отстал от цепи. Пусто, пока состояние не измерено',
  })
  getNodeSyncState(): NodeSyncStateDTO | undefined {
    return this.nodeSyncHealthService.getState();
  }

  @Subscription(() => NodeSyncStateDTO, {
    name: 'nodeSyncState',
    description: 'Ход догона цепи узлом кооператива',
    resolve: (payload: { nodeSyncState: NodeSyncStateDTO }) => payload.nodeSyncState,
  })
  nodeSyncState(): AsyncIterator<{ nodeSyncState: NodeSyncStateDTO }> {
    return this.pubSub.asyncIterator(NODE_SYNC_STATE_TOPIC);
  }
}
