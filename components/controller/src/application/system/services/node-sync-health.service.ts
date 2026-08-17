import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisKeys } from '@coopenomics/parser2';
import type { PubSub } from 'graphql-subscriptions';
import config from '~/config/config';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { REDIS_PORT, type RedisPort } from '~/domain/common/ports/redis.port';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NodeSyncStateDTO } from '../dto/node-sync-state.dto';
import { NodeSyncOutage, NodeSyncStatus } from '../enum/node-sync-status.enum';

/** Топик подписки на состояние узла. Один на инстанс: кооператив здесь один. */
export const NODE_SYNC_STATE_TOPIC = 'system:node-sync-state';

/**
 * Насколько узел кооператива отстал от цепи.
 *
 * Отставание считается по позиции чтения парсера (`parser2:sync:<chain_id>`,
 * обновляется на каждом прочитанном блоке) против головы цепи из `get_info`.
 * По журналу дельт считать нельзя: события контрактов кооператива редки — на
 * сотнях тысяч блоков их бывает две сотни, и «последняя запись» отстаёт от
 * реальной позиции чтения на всю пустую часть цепи.
 *
 * Состояние публикуется подписчикам, а не опрашивается: тик считает, и только
 * заметное изменение уходит в канал — иначе поток превращается в шум.
 */
@Injectable()
export class NodeSyncHealthService {
  /**
   * Отставание, о котором стоит сообщить повторно при том же статусе. Меньшая
   * разница на догоне в сотни тысяч блоков ничего не меняет для ожидающего.
   */
  private static readonly NOTABLE_LAG_CHANGE_RATIO = 0.05;
  private static readonly NOTABLE_LAG_CHANGE_BLOCKS = 50;
  /** Сглаживание скорости догона: одиночный медленный тик не должен ломать оценку. */
  private static readonly RATE_SMOOTHING = 0.3;

  private state: NodeSyncStateDTO = { status: NodeSyncStatus.SYNCED };
  private publishedState?: NodeSyncStateDTO;
  /** Тики подряд у головы цепи — вторая половина гистерезиса. */
  private healthyTicks = 0;
  private previousLag?: number;
  private previousLagAt?: number;
  private smoothedCatchUpRate?: number;

  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(BLOCKCHAIN_PORT) private readonly blockchain: BlockchainPort
  ) {
    this.logger.setContext(NodeSyncHealthService.name);
  }

  /** Текущее состояние без ожидания следующего тика — для первой отрисовки. */
  getState(): NodeSyncStateDTO {
    return this.state;
  }

  @Interval('node-sync-health', config.blockchain.sync_tick_ms)
  async tick(): Promise<void> {
    try {
      const next = await this.computeState();
      this.state = next;
      if (this.shouldPublish(next)) {
        this.publishedState = next;
        await this.pubSub.publish(NODE_SYNC_STATE_TOPIC, { nodeSyncState: next });
      }
    } catch (error: any) {
      // Тик не имеет права уронить планировщик: следующий пересчитает всё заново.
      this.logger.error(`Не удалось пересчитать состояние синхронизации: ${error?.message}`, error?.stack);
    }
  }

  private async computeState(): Promise<NodeSyncStateDTO> {
    const head = await this.readHeadBlockNum();
    if (head === null) {
      return this.outageState(NodeSyncOutage.CHAIN);
    }

    const cursor = await this.redis.hgetall(RedisKeys.syncHash(config.blockchain.id));
    const currentBlockNum = Number(cursor?.block_num);
    if (!cursor || !Number.isFinite(currentBlockNum)) {
      // Позиции чтения нет вовсе — узел ещё ни одного блока не прочитал.
      return this.outageState(NodeSyncOutage.READER, { head_block_num: head });
    }

    const cursorUpdatedAt = cursor.last_updated;
    if (this.isCursorStale(cursorUpdatedAt)) {
      return this.outageState(NodeSyncOutage.READER, {
        head_block_num: head,
        current_block_num: currentBlockNum,
        lag_blocks: Math.max(0, head - currentBlockNum),
        cursor_updated_at: cursorUpdatedAt,
      });
    }

    const lag = Math.max(0, head - currentBlockNum);
    const status = this.applyHysteresis(lag);
    const rate = this.updateCatchUpRate(lag);

    return {
      status,
      current_block_num: currentBlockNum,
      head_block_num: head,
      lag_blocks: lag,
      catch_up_blocks_per_second: rate,
      estimated_seconds_remaining: rate && rate > 0 ? Math.ceil(lag / rate) : undefined,
      cursor_updated_at: cursorUpdatedAt,
    };
  }

  private async readHeadBlockNum(): Promise<number | null> {
    try {
      const info = await this.blockchain.getInfo();
      return Number(info.head_block_num);
    } catch (error: any) {
      this.logger.warn(`Цепь не отдала своё состояние: ${error?.message}`);
      return null;
    }
  }

  private isCursorStale(lastUpdated?: string): boolean {
    if (!lastUpdated) return true;
    const movedAt = Date.parse(lastUpdated);
    if (Number.isNaN(movedAt)) return true;
    return Date.now() - movedAt > config.blockchain.sync_stale_cursor_seconds * 1000;
  }

  /**
   * Обрыв связи снимает счётчики: скорость догона, посчитанная до паузы, к
   * состоянию после неё отношения не имеет.
   */
  private outageState(outage: NodeSyncOutage, rest: Partial<NodeSyncStateDTO> = {}): NodeSyncStateDTO {
    this.healthyTicks = 0;
    this.previousLag = undefined;
    this.previousLagAt = undefined;
    this.smoothedCatchUpRate = undefined;
    return { status: NodeSyncStatus.DISCONNECTED, outage, ...rest };
  }

  /**
   * Разные пороги на вход и выход. Порог в несколько блоков — это секунды
   * цепи, и на живой сети отставание колеблется вокруг него: при одном пороге
   * заглушка замигала бы посреди работы. Выход дополнительно требует
   * нескольких тиков подряд у головы.
   */
  private applyHysteresis(lag: number): NodeSyncStatus {
    const wasLagging = this.state.status !== NodeSyncStatus.SYNCED;

    if (!wasLagging) {
      if (lag >= config.blockchain.sync_lagging_lag_blocks) {
        this.healthyTicks = 0;
        return NodeSyncStatus.LAGGING;
      }
      return NodeSyncStatus.SYNCED;
    }

    if (lag <= config.blockchain.sync_healthy_lag_blocks) {
      this.healthyTicks += 1;
      if (this.healthyTicks >= config.blockchain.sync_healthy_ticks) {
        return NodeSyncStatus.SYNCED;
      }
    } else {
      this.healthyTicks = 0;
    }
    return NodeSyncStatus.LAGGING;
  }

  /**
   * Скорость догона — насколько сокращается отставание, а не сколько блоков
   * прочитано: голова цепи всё это время уходит вперёд, и по темпу чтения
   * оценка вышла бы вдвое оптимистичнее правды. Отставание, которое не
   * сокращается, оценки не даёт вовсе — лучше молчать, чем обещать.
   */
  private updateCatchUpRate(lag: number): number | undefined {
    const now = Date.now();
    const previousLag = this.previousLag;
    const previousLagAt = this.previousLagAt;
    this.previousLag = lag;
    this.previousLagAt = now;

    if (previousLag === undefined || previousLagAt === undefined) return this.smoothedCatchUpRate;

    const elapsedSeconds = (now - previousLagAt) / 1000;
    if (elapsedSeconds <= 0) return this.smoothedCatchUpRate;

    const rate = (previousLag - lag) / elapsedSeconds;
    if (rate <= 0) {
      // Отставание стоит или растёт: сглаживать нечего, оценки нет.
      this.smoothedCatchUpRate = undefined;
      return undefined;
    }

    const smoothing = NodeSyncHealthService.RATE_SMOOTHING;
    this.smoothedCatchUpRate =
      this.smoothedCatchUpRate === undefined
        ? rate
        : this.smoothedCatchUpRate * (1 - smoothing) + rate * smoothing;
    return this.smoothedCatchUpRate;
  }

  /**
   * В канал уходит смена состояния и заметное движение остатка. Каждый тик
   * публиковать нельзя: подписчик получал бы поток, в котором ничего не
   * меняется, а рабочий стол — лишние перерисовки.
   */
  private shouldPublish(next: NodeSyncStateDTO): boolean {
    const previous = this.publishedState;
    if (!previous) return true;
    if (previous.status !== next.status || previous.outage !== next.outage) return true;
    if (next.status === NodeSyncStatus.SYNCED) return false;

    const previousLag = previous.lag_blocks ?? 0;
    const nextLag = next.lag_blocks ?? 0;
    const threshold = Math.max(
      NodeSyncHealthService.NOTABLE_LAG_CHANGE_BLOCKS,
      previousLag * NodeSyncHealthService.NOTABLE_LAG_CHANGE_RATIO
    );
    return Math.abs(previousLag - nextLag) >= threshold;
  }
}
