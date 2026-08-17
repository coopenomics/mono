import config from '~/config/config';
import { NodeSyncHealthService } from '~/application/system/services/node-sync-health.service';
import { NodeSyncOutage, NodeSyncStatus } from '~/application/system/enum/node-sync-status.enum';

/**
 * Отставание узла от цепи: что видит рабочий стол и когда заглушка снимается.
 * Пороги подменяются на предсказуемые — тест проверяет правило, а не дефолты.
 */
describe('Состояние синхронизации узла с цепью', () => {
  const LAGGING_AT = 40;
  const HEALTHY_AT = 10;
  const HEALTHY_TICKS = 3;
  const STALE_SECONDS = 60;

  let logger: any;
  let pubSub: { publish: jest.Mock };
  let redis: { hgetall: jest.Mock; publish: jest.Mock; subscribe: jest.Mock };
  let blockchain: { getInfo: jest.Mock };
  let service: NodeSyncHealthService;

  /** Курсор, который парсер обновил только что. */
  const cursorAt = (blockNum: number, movedSecondsAgo = 0) => ({
    block_num: String(blockNum),
    block_id: 'a'.repeat(64),
    last_updated: new Date(Date.now() - movedSecondsAgo * 1000).toISOString(),
  });

  beforeEach(() => {
    config.blockchain.sync_lagging_lag_blocks = LAGGING_AT;
    config.blockchain.sync_healthy_lag_blocks = HEALTHY_AT;
    config.blockchain.sync_healthy_ticks = HEALTHY_TICKS;
    config.blockchain.sync_stale_cursor_seconds = STALE_SECONDS;

    logger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    redis = { hgetall: jest.fn(), publish: jest.fn(), subscribe: jest.fn() };
    blockchain = { getInfo: jest.fn() };

    service = new NodeSyncHealthService(logger, pubSub as any, redis as any, blockchain as any);
  });

  /** Один тик при заданных голове цепи и позиции чтения. */
  const tickWith = async (headBlockNum: number, cursor: Record<string, string> | null) => {
    blockchain.getInfo.mockResolvedValue({ head_block_num: headBlockNum } as any);
    redis.hgetall.mockResolvedValue(cursor);
    await service.tick();
    return service.getState();
  };

  describe('узел у головы цепи', () => {
    it('отдаёт рабочее состояние и нулевое отставание', async () => {
      const state = await tickWith(1000, cursorAt(1000));

      expect(state.status).toBe(NodeSyncStatus.SYNCED);
      expect(state.lag_blocks).toBe(0);
      expect(state.current_block_num).toBe(1000);
      expect(state.head_block_num).toBe(1000);
    });

    it('первое состояние уходит подписчикам', async () => {
      await tickWith(1000, cursorAt(1000));

      expect(pubSub.publish).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ nodeSyncState: expect.objectContaining({ status: NodeSyncStatus.SYNCED }) })
      );
    });
  });

  describe('узел догоняет цепь', () => {
    it('отставание больше порога закрывает рабочий стол', async () => {
      const state = await tickWith(1000, cursorAt(1000 - LAGGING_AT));

      expect(state.status).toBe(NodeSyncStatus.LAGGING);
      expect(state.lag_blocks).toBe(LAGGING_AT);
    });

    it('отставание между порогами рабочий стол не закрывает', async () => {
      // Иначе заглушка появлялась бы от обычного дрожания на живой сети.
      const state = await tickWith(1000, cursorAt(1000 - (LAGGING_AT - 1)));

      expect(state.status).toBe(NodeSyncStatus.SYNCED);
    });

    it('заглушка держится, пока узел не продержится у головы несколько тиков', async () => {
      await tickWith(1000, cursorAt(1000 - LAGGING_AT));

      for (let tick = 1; tick < HEALTHY_TICKS; tick++) {
        const state = await tickWith(1000 + tick, cursorAt(1000 + tick));
        expect(state.status).toBe(NodeSyncStatus.LAGGING);
      }

      const state = await tickWith(1000 + HEALTHY_TICKS, cursorAt(1000 + HEALTHY_TICKS));
      expect(state.status).toBe(NodeSyncStatus.SYNCED);
    });

    it('всплеск отставания посреди догона обнуляет отсчёт здоровых тиков', async () => {
      await tickWith(1000, cursorAt(1000 - LAGGING_AT));
      await tickWith(1001, cursorAt(1001));
      await tickWith(1002, cursorAt(1002 - (HEALTHY_AT + 5)));
      await tickWith(1003, cursorAt(1003));
      await tickWith(1004, cursorAt(1004));

      // Здоровых тиков подряд пока два из трёх.
      expect(service.getState().status).toBe(NodeSyncStatus.LAGGING);

      await tickWith(1005, cursorAt(1005));
      expect(service.getState().status).toBe(NodeSyncStatus.SYNCED);
    });
  });

  describe('оценка времени догона', () => {
    it('считается по сокращению отставания, а не по темпу чтения', async () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
        await tickWith(10_000, cursorAt(0));

        // Через 10 с отставание сократилось на 1000 блоков: 100 блоков/с,
        // хотя прочитано было 2000 — голова тоже ушла вперёд.
        jest.setSystemTime(new Date('2026-08-17T00:00:10.000Z'));
        const state = await tickWith(11_000, cursorAt(2000));

        expect(state.lag_blocks).toBe(9000);
        expect(state.catch_up_blocks_per_second).toBeCloseTo(100, 5);
        expect(state.estimated_seconds_remaining).toBe(90);
      } finally {
        jest.useRealTimers();
      }
    });

    it('растущее отставание оценки не даёт — обещать нечего', async () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
        await tickWith(10_000, cursorAt(5000));

        jest.setSystemTime(new Date('2026-08-17T00:00:10.000Z'));
        const state = await tickWith(20_000, cursorAt(5100));

        expect(state.catch_up_blocks_per_second).toBeUndefined();
        expect(state.estimated_seconds_remaining).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('связи нет', () => {
    it('молчащая цепь — это обрыв, а не мгновенный догон', async () => {
      blockchain.getInfo.mockRejectedValue(new Error('ECONNREFUSED'));
      redis.hgetall.mockResolvedValue(cursorAt(1000));

      await service.tick();

      expect(service.getState().status).toBe(NodeSyncStatus.DISCONNECTED);
      expect(service.getState().outage).toBe(NodeSyncOutage.CHAIN);
    });

    it('позиции чтения нет вовсе — узел не прочитал ни одного блока', async () => {
      const state = await tickWith(1000, null);

      expect(state.status).toBe(NodeSyncStatus.DISCONNECTED);
      expect(state.outage).toBe(NodeSyncOutage.READER);
    });

    it('неподвижная позиция чтения дольше окна — чтение остановлено', async () => {
      const state = await tickWith(1000, cursorAt(900, STALE_SECONDS + 5));

      expect(state.status).toBe(NodeSyncStatus.DISCONNECTED);
      expect(state.outage).toBe(NodeSyncOutage.READER);
      expect(state.lag_blocks).toBe(100);
    });

    it('после обрыва отсчёт здоровых тиков начинается заново', async () => {
      await tickWith(1000, cursorAt(1000 - LAGGING_AT));
      await tickWith(1001, cursorAt(1001));
      await tickWith(1002, null);

      await tickWith(1003, cursorAt(1003));
      await tickWith(1004, cursorAt(1004));
      expect(service.getState().status).toBe(NodeSyncStatus.LAGGING);

      await tickWith(1005, cursorAt(1005));
      expect(service.getState().status).toBe(NodeSyncStatus.SYNCED);
    });
  });

  describe('поток подписчикам', () => {
    it('неизменное состояние повторно не публикуется', async () => {
      await tickWith(1000, cursorAt(1000));
      pubSub.publish.mockClear();

      await tickWith(1001, cursorAt(1001));

      expect(pubSub.publish).not.toHaveBeenCalled();
    });

    it('незначительное движение остатка в канал не идёт', async () => {
      await tickWith(100_000, cursorAt(0));
      pubSub.publish.mockClear();

      await tickWith(100_001, cursorAt(10));

      expect(pubSub.publish).not.toHaveBeenCalled();
    });

    it('заметное сокращение остатка публикуется', async () => {
      await tickWith(100_000, cursorAt(0));
      pubSub.publish.mockClear();

      await tickWith(100_001, cursorAt(50_000));

      expect(pubSub.publish).toHaveBeenCalledTimes(1);
    });

    it('смена состояния публикуется всегда', async () => {
      await tickWith(1000, cursorAt(1000));
      pubSub.publish.mockClear();

      await tickWith(1000, cursorAt(1000 - LAGGING_AT));

      expect(pubSub.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('устойчивость тика', () => {
    it('сбой чтения позиции не роняет тик и сохраняет прошлое состояние', async () => {
      await tickWith(1000, cursorAt(1000));

      redis.hgetall.mockRejectedValue(new Error('Redis недоступен'));
      await expect(service.tick()).resolves.toBeUndefined();

      expect(service.getState().status).toBe(NodeSyncStatus.SYNCED);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
