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
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listener = (payload: T) => {
    if (match(payload)) finish(payload);
  };
  function finish(value: T | null) {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    source.off(event, listener);
    settle(value);
  }
  // Сначала подписка: если источник её не принял, таймер не заводится и не
  // срабатывает потом в чужом контексте.
  source.on(event, listener);
  // timing: timeout — предел ожидания чужого факта, дальше ответ как есть.
  timer = setTimeout(() => finish(null), timeoutMs);
  return { promise, cancel: () => finish(null) };
}
