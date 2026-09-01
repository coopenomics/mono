import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PROVIDER } from '~/infrastructure/redis/redis.provider';
import type { UserActivityPort } from '~/domain/metrics/ports/user-activity.port';

/**
 * Счётчик заходивших пайщиков поверх HyperLogLog Redis — реализация
 * {@link UserActivityPort}. Обоснование самого подхода см. в порту.
 *
 * Один ключ на сутки: `coop:activity:daily:<YYYY-MM-DD>`. Недельный и месячный
 * показатели отдельно не хранятся — PFCOUNT принимает несколько ключей и
 * объединяет их на лету, без временных ключей и без двойного учёта пайщика,
 * заходившего несколько дней подряд.
 *
 * СУТКИ СЧИТАЮТСЯ ПО UTC. Это осознанно: граница проходит в 03:00 по Москве,
 * когда заходов практически нет, — то есть сутки не разрезают активный день
 * пополам. Календарная дата в имени ключа при этом остаётся воспроизводимой
 * независимо от того, какой часовой пояс выставлен в контейнере.
 */
@Injectable()
export class RedisUserActivityStore implements UserActivityPort {
  /**
   * Сколько суток храним. Больше самого длинного окна (30 суток) с запасом,
   * чтобы месячный показатель не обрезался у края хранения.
   */
  private static readonly RETENTION_SEC = 40 * 24 * 60 * 60;
  private static readonly PREFIX = 'coop:activity:daily:';

  /**
   * Каким ключам этот процесс уже выставил срок жизни. Без этого EXPIRE уходил
   * бы в Redis на каждом запросе пайщика — команда дешёвая, но бессмысленная:
   * срок у суточного ключа один и тот же весь день.
   */
  private readonly ttlAssigned = new Set<string>();

  constructor(
    @Inject(REDIS_PROVIDER)
    private readonly redis: { publisher: Redis }
  ) {}

  private keyForDaysAgo(daysAgo: number): string {
    const day = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return `${RedisUserActivityStore.PREFIX}${day.toISOString().slice(0, 10)}`;
  }

  async markActive(username: string): Promise<void> {
    if (!username) return;
    const key = this.keyForDaysAgo(0);

    try {
      if (this.ttlAssigned.has(key)) {
        await this.redis.publisher.pfadd(key, username);
        return;
      }

      // Оба действия одним обращением: отдельные PFADD и EXPIRE стоили бы два
      // круга по сети на каждый первый запрос суток.
      await this.redis.publisher
        .pipeline()
        .pfadd(key, username)
        .expire(key, RedisUserActivityStore.RETENTION_SEC)
        .exec();

      // Вчерашние ключи в памяти не нужны — набор не должен расти вечно.
      this.ttlAssigned.clear();
      this.ttlAssigned.add(key);
    } catch {
      // След захода — телеметрия. Молчим: уронить из-за неё запрос пайщика,
      // который уже прошёл проверку токена, недопустимо.
    }
  }

  async countActive(days: number): Promise<number> {
    const window = Math.max(1, Math.floor(days));
    const keys = Array.from({ length: window }, (_, i) => this.keyForDaysAgo(i));
    // Несуществующий ключ PFCOUNT считает пустым, отдельная проверка не нужна.
    return await this.redis.publisher.pfcount(...keys);
  }
}
