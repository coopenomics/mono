export interface RedisPort {
  publish(channel: string, message: any): Promise<void>;
  subscribe(channel: string, handler: (message: any) => void): void;
  /**
   * Чтение hash целиком. Нужно тем, кто читает состояние, которое пишет не
   * контроллер, а соседний процесс (курсор синхронизации парсера). Пустой hash
   * и отсутствующий ключ Redis не различает — обе ситуации дают `null`.
   */
  hgetall(key: string): Promise<Record<string, string> | null>;
}

export const REDIS_PORT = Symbol('RedisPort');
