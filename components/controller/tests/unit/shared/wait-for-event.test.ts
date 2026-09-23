/**
 * Ожидание чужого факта событием, а не опросом базы (выдача и возвраты Стола
 * заказов ждут решения робота совета).
 *
 * Инварианты:
 *   - отобранное событие разрешает ожидание, прочие — нет;
 *   - по пределу — null;
 *   - cancel() снимает ожидание сразу;
 *   - подписка снимается при любом исходе — слушатели не копятся.
 */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { waitForEvent } from '@coopenomics/extension-kit';

type Ev = { id: string; stage: string };

describe('waitForEvent', () => {
  it('отобранное событие разрешает ожидание, чужие — нет', async () => {
    const bus = new EventEmitter2();
    const wait = waitForEvent<Ev>(bus, 'saga.updated', (e) => e.id === 's1' && e.stage === 'DONE', 1_000);

    bus.emit('saga.updated', { id: 's2', stage: 'DONE' });
    bus.emit('saga.updated', { id: 's1', stage: 'PENDING' });
    bus.emit('saga.updated', { id: 's1', stage: 'DONE' });

    await expect(wait.promise).resolves.toEqual({ id: 's1', stage: 'DONE' });
    expect(bus.listenerCount('saga.updated')).toBe(0);
  });

  it('по пределу — null, подписка снята', async () => {
    const bus = new EventEmitter2();
    const wait = waitForEvent<Ev>(bus, 'saga.updated', () => true, 20);

    await expect(wait.promise).resolves.toBeNull();
    expect(bus.listenerCount('saga.updated')).toBe(0);
  });

  it('cancel — сразу null, позднее событие ничего не меняет', async () => {
    const bus = new EventEmitter2();
    const wait = waitForEvent<Ev>(bus, 'saga.updated', () => true, 1_000);

    wait.cancel();
    bus.emit('saga.updated', { id: 's1', stage: 'DONE' });

    await expect(wait.promise).resolves.toBeNull();
    expect(bus.listenerCount('saga.updated')).toBe(0);
  });
});
