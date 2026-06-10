export interface RedisPort {
  publish(channel: string, message: any): Promise<void>;
  subscribe(channel: string, handler: (message: any) => void): void;
  /** SET key value NX EX ttl — true, если ключ записан (не существовал). */
  setSingleUse(key: string, value: string, ttlSec: number): Promise<boolean>;
  /** Атомарно прочитать и удалить ключ (GETDEL) — single-use consume. */
  consumeSingleUse(key: string): Promise<string | null>;
}

export const REDIS_PORT = Symbol('RedisPort');
