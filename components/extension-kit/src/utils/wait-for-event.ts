/** Источник событий: подписка и отписка (EventEmitter2, EventEmitter). */
export interface EventSource {
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
}

export interface EventWait<T> {
  /** Событие, прошедшее отбор, либо `null` по пределу или отмене. */
  promise: Promise<T | null>;
  /** Снять ожидание досрочно (факт уже виден без события). */
  cancel(): void;
}

/**
 * Дождаться события, а не опрашивать базу. Для случаев, когда ответ зависит
 * от чужого факта — робот совета решил, обратный вызов перевёл сагу: свой
 * блок транзакция дожидается сама, а чужое действие приходит событием.
 *
 * Порядок у вызывающего: сначала `waitForEvent`, потом одно чтение текущего
 * состояния — если факт уже случился, `cancel()` и ответ сразу; так событие
 * между чтением и подпиской не теряется. Подписка снимается при любом исходе.
 */
export function waitForEvent<T>(
  source: EventSource,
  event: string,
  match: (payload: T) => boolean,
  timeoutMs: number
): EventWait<T> {
  let settle!: (value: T | null) => void;
  const promise = new Promise<T | null>((resolve) => {
    settle = resolve;
  });
  const listener = (payload: T) => {
    if (match(payload)) finish(payload);
  };
  // timing: timeout — предел ожидания чужого факта, дальше ответ как есть.
  const timer = setTimeout(() => finish(null), timeoutMs);
  let done = false;
  function finish(value: T | null) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    source.off(event, listener);
    settle(value);
  }
  source.on(event, listener);
  return { promise, cancel: () => finish(null) };
}
