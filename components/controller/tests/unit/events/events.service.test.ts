/**
 * Unit-тесты EventsService.emitAsyncWithTimeout (Story 1.3).
 *
 * Фокус — барьер форка: ждём завершения обработчиков отката, но не дольше
 * timeoutMs (TTL force-resume), и не глотаем ошибку обработчика.
 */

import { EventsService } from '~/infrastructure/events/events.service';

function makeService(emitAsyncImpl: (e: string, d: any) => Promise<any>) {
  const emitter = {
    emit: jest.fn(),
    emitAsync: jest.fn(emitAsyncImpl),
  } as any;
  return { service: new EventsService(emitter), emitter };
}

describe('EventsService.emitAsyncWithTimeout (Story 1.3)', () => {
  it('возвращает true, когда обработчики завершились в срок', async () => {
    const { service } = makeService(async () => [undefined]);
    const ok = await service.emitAsyncWithTimeout('fork::100', { block_num: 100 }, 1000);
    expect(ok).toBe(true);
  });

  it('возвращает false (force-resume), когда обработчик завис дольше timeoutMs', async () => {
    const { service } = makeService(() => new Promise(() => {/* никогда не резолвится */}));
    const ok = await service.emitAsyncWithTimeout('fork::100', { block_num: 100 }, 20);
    expect(ok).toBe(false);
  });

  it('пробрасывает ошибку обработчика (не глотаем)', async () => {
    const { service } = makeService(async () => {
      throw new Error('rollback failed');
    });
    await expect(service.emitAsyncWithTimeout('fork::100', { block_num: 100 }, 1000)).rejects.toThrow(
      'rollback failed'
    );
  });

  it('emitAsync делегирует в EventEmitter2', async () => {
    const { service, emitter } = makeService(async () => ['r']);
    const res = await service.emitAsync('delta::x::y', { a: 1 });
    expect(emitter.emitAsync).toHaveBeenCalledWith('delta::x::y', { a: 1 });
    expect(res).toEqual(['r']);
  });
});
