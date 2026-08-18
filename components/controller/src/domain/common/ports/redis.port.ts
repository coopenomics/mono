export interface RedisPort {
  publish(channel: string, message: any): Promise<void>;
  subscribe(channel: string, handler: (message: any) => void): void;
  /** SET key value NX EX ttl — true, если ключ записан (не существовал). */
  setSingleUse(key: string, value: string, ttlSec: number): Promise<boolean>;
  /** Атомарно прочитать и удалить ключ (GETDEL) — single-use consume. */
  consumeSingleUse(key: string): Promise<string | null>;
  /**
   * Чтение hash целиком. Нужно тем, кто читает состояние, которое пишет не
   * контроллер, а соседний процесс (курсор синхронизации парсера). Пустой hash
   * и отсутствующий ключ Redis не различает — обе ситуации дают `null`.
   */
  hgetall(key: string): Promise<Record<string, string> | null>;
}

export const REDIS_PORT = Symbol('RedisPort');
