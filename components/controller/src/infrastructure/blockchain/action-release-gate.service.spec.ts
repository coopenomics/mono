/** Выпуск действий в шину по факту разбора блока, а не по таймеру. */
jest.mock('~/config', () => ({
  config: { coopname: 'voskhod', redis: {}, blockchain: { id: 'chain', action_release_poll_ms: 60_000, action_release_max_wait_ms: 50 } },
}));
import { ActionReleaseGate } from './action-release-gate.service';

const logger = { setContext: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

describe('ActionReleaseGate', () => {
  afterEach(() => jest.clearAllMocks());

  it('событие следующего блока выпускает действия предыдущих, но не своего', async () => {
    const gate = new ActionReleaseGate(logger);
    const released: number[] = [];
    gate.enqueue(10, () => released.push(10));
    gate.enqueue(11, () => released.push(11));

    gate.onBlockSeen(11);
    expect(released).toEqual([10]);
    gate.onBlockSeen(12);
    expect(released).toEqual([10, 11]);
    await gate.onModuleDestroy();
  });

  it('на простое: parser2 дочитал дальше, поток разобран — выпускает сразу', async () => {
    const gate = new ActionReleaseGate(logger);
    const released: number[] = [];
    gate.enqueue(20, () => released.push(20));

    await gate.tick({ parser_block: 21, pending: 0, lag: 0 });
    expect(released).toEqual([20]);
    expect(logger.warn).not.toHaveBeenCalled();
    await gate.onModuleDestroy();
  });

  it('в потоке ещё есть непрочитанное или неподтверждённое — ждёт', async () => {
    const gate = new ActionReleaseGate(logger);
    const released: number[] = [];
    gate.enqueue(30, () => released.push(30));

    await gate.tick({ parser_block: 31, pending: 0, lag: 2 });
    await gate.tick({ parser_block: 31, pending: 1, lag: 0 });
    await gate.tick({ parser_block: 30, pending: 0, lag: 0 });
    expect(released).toEqual([]);
    await gate.onModuleDestroy();
  });

  it('Redis молчит — выпускает по страховке, с предупреждением в журнал', async () => {
    const gate = new ActionReleaseGate(logger);
    const released: number[] = [];
    gate.enqueue(40, () => released.push(40));

    await gate.tick(null);
    expect(released).toEqual([]);
    await new Promise((r) => setTimeout(r, 60));
    await gate.tick(null);
    expect(released).toEqual([40]);
    expect(logger.warn).toHaveBeenCalled();
    await gate.onModuleDestroy();
  });

  it('упавший обработчик не мешает выпуску остальных', async () => {
    const gate = new ActionReleaseGate(logger);
    const released: number[] = [];
    gate.enqueue(50, () => {
      throw new Error('обработчик упал');
    });
    gate.enqueue(50, () => released.push(50));

    gate.onBlockSeen(51);
    expect(released).toEqual([50]);
    expect(logger.error).toHaveBeenCalled();
    await gate.onModuleDestroy();
  });

  describe('ожидание транзакцией разбора её блока', () => {
    it('ждёт, пока потребитель не возьмёт событие следующего блока', async () => {
      const gate = new ActionReleaseGate(logger);
      gate.setActive(true);
      let done: boolean | undefined;
      const wait = gate.waitProcessed(50, 1_000).then((v) => (done = v));

      gate.onBlockSeen(50);
      await Promise.resolve();
      expect(done).toBeUndefined();
      gate.onBlockSeen(51);
      await wait;
      expect(done).toBe(true);
      expect(gate.isProcessed(50)).toBe(true);
      await gate.onModuleDestroy();
    });

    it('на простое: parser2 дочитал дальше и поток разобран — ожидание снимается', async () => {
      const gate = new ActionReleaseGate(logger);
      gate.setActive(true);
      const wait = gate.waitProcessed(60, 1_000);

      await gate.tick({ parser_block: 61, pending: 0, lag: 0 });
      await expect(wait).resolves.toBe(true);
      await gate.onModuleDestroy();
    });

    it('блок уже разобран — ответ сразу', async () => {
      const gate = new ActionReleaseGate(logger);
      gate.setActive(true);
      gate.onBlockSeen(71);

      await expect(gate.waitProcessed(70, 1_000)).resolves.toBe(true);
      expect(gate.size).toBe(0);
    });

    it('не дождались за предел — false, ожидание не остаётся в очереди', async () => {
      const gate = new ActionReleaseGate(logger);
      gate.setActive(true);

      await expect(gate.waitProcessed(80, 20)).resolves.toBe(false);
      expect(gate.size).toBe(0);
      await gate.onModuleDestroy();
    });

    it('страховка действий ожидание транзакции не выпускает — у него свой предел', async () => {
      const gate = new ActionReleaseGate(logger);
      gate.setActive(true);
      let done: boolean | undefined;
      void gate.waitProcessed(90, 200).then((v) => (done = v));

      await new Promise((r) => setTimeout(r, 60));
      await gate.tick(null);
      expect(done).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
      await gate.onModuleDestroy();
    });

    it('потребитель не запущен — ждать нечего, false сразу', async () => {
      const gate = new ActionReleaseGate(logger);

      await expect(gate.waitProcessed(100, 1_000)).resolves.toBe(false);
      expect(gate.size).toBe(0);
    });

    it('форк отменил блоки — они снова не разобраны', async () => {
      const gate = new ActionReleaseGate(logger);
      gate.setActive(true);
      gate.onBlockSeen(121);
      expect(gate.isProcessed(120)).toBe(true);

      gate.onFork(115);
      expect(gate.isProcessed(114)).toBe(true);
      expect(gate.isProcessed(115)).toBe(false);
      expect(gate.isProcessed(120)).toBe(false);
    });
  });
});
