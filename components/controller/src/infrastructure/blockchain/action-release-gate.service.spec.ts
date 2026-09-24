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
});
