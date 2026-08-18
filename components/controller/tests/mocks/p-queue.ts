/**
 * CJS-совместимая замена `p-queue` для юнит-прогона (подключается через
 * moduleNameMapper в jest.config.js).
 *
 * `p-queue` с 7-й версии — pure ESM ("type": "module"). Сам controller его не
 * использует: очередь приходит транзитивно из `@coopenomics/parser2`, где ею
 * сериализуется обработка блоков. В рантайме это работает — Node 22 умеет
 * `require()` синхронного ESM, — но загрузчик jest живёт в CJS и падает на
 * импорте с «Cannot use import statement outside a module». Валится при этом не
 * один тест, а всякий сьют, который через модуль приложения дотягивается до
 * потребителя цепи: расширения, витрина, приёмка АПП.
 *
 * Поэтому здесь не пустышка, а настоящая последовательная очередь с тем же
 * поведением: задачи идут не более `concurrency` за раз, `add` отдаёт результат
 * задачи, `onIdle` ждёт опустошения. Тест, которому нужны тайминги и интервалы
 * настоящего p-queue, — это уже интеграционный прогон parser2, не юнит.
 */
export default class PQueue {
  private readonly concurrency: number;
  private running = 0;
  /** Ожидающие своей очереди: каждый разбудит следующую задачу. */
  private readonly waiting: Array<() => void> = [];
  /** Ожидающие полного простоя очереди. */
  private readonly idleWaiters: Array<() => void> = [];

  constructor(options: { concurrency?: number } = {}) {
    const requested = options.concurrency ?? Number.POSITIVE_INFINITY;
    this.concurrency = requested > 0 ? requested : 1;
  }

  /** Сколько задач стоит в очереди (ещё не начаты). */
  public get size(): number {
    return this.waiting.length;
  }

  /** Сколько задач выполняется прямо сейчас. */
  public get pending(): number {
    return this.running;
  }

  public async add<T>(task: () => Promise<T> | T): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      return await task();
    } finally {
      this.running -= 1;
      const next = this.waiting.shift();
      if (next) {
        next();
      } else if (this.running === 0) {
        // Очередь опустела — будим всех, кто ждал простоя.
        for (const waiter of this.idleWaiters.splice(0)) waiter();
      }
    }
  }

  public async onIdle(): Promise<void> {
    if (this.running === 0 && this.waiting.length === 0) return;
    await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }
}
