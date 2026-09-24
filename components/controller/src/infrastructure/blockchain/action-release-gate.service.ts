import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from '~/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

interface PendingAction {
  block_num: number;
  queued_at: number;
  release: () => void;
}

/** Что сообщают parser2 и Redis о разборе потока — для решения «блок закончился». */
export interface StreamProgress {
  /** Блок, до которого parser2 дочитал цепь. */
  parser_block: number;
  /** Доставлено группе, но не подтверждено. */
  pending: number;
  /** Опубликовано в стрим, но группой ещё не прочитано (null — Redis не знает). */
  lag: number | null;
}

/**
 * Выпуск событий действий в шину — по факту, а не по таймеру. Обработчики
 * действий читают состояние, которое пишут дельты того же блока, поэтому
 * действие блока N уходит в шину, когда блок N разобран целиком:
 *
 *  1. пришло событие более позднего блока — события идут строго по порядку,
 *     значит всё из блока N уже обработано и записано;
 *  2. цепь простаивает — parser2 дочитал дальше блока N, а у группы
 *     потребителя нет ни непрочитанных (lag), ни неподтверждённых (pending)
 *     событий: из блока N больше ничего не придёт.
 *
 * Страховка по времени — только на случай, когда Redis не отвечает: действие
 * уходит с предупреждением в журнал, чтобы обработчики не встали насовсем.
 * Прежде вместо этого стояла пауза в 3 секунды на каждое действие.
 */
@Injectable()
export class ActionReleaseGate implements OnModuleDestroy {
  private readonly queue: PendingAction[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private redis: Redis | null = null;
  private checking = false;

  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(ActionReleaseGate.name);
  }

  /** Поставить действие блока в очередь на выпуск. */
  enqueue(block_num: number, release: () => void): void {
    this.queue.push({ block_num, queued_at: Date.now(), release });
    this.ensureTicker();
  }

  /** Потребитель взял событие блока — всё из более ранних блоков разобрано. */
  onBlockSeen(block_num: number): void {
    this.releaseWhere((a) => a.block_num < block_num);
  }

  /** Сколько действий ждёт выпуска — для тестов и наблюдения. */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Один шаг проверки на простое. Выпускает то, что разобрано по факту, и —
   * со страховкой — то, что ждёт дольше отведённого.
   */
  async tick(progress?: StreamProgress | null): Promise<void> {
    if (!this.queue.length) return;
    const state = progress === undefined ? await this.readProgress() : progress;
    if (state && state.pending === 0 && state.lag === 0) {
      this.releaseWhere((a) => a.block_num < state.parser_block);
    }
    const maxWait = config.blockchain.action_release_max_wait_ms;
    const now = Date.now();
    const overdue = this.queue.filter((a) => now - a.queued_at >= maxWait);
    if (overdue.length) {
      this.logger.warn(
        `Действия блоков ${[...new Set(overdue.map((a) => a.block_num))].join(', ')} выпущены по страховке ${maxWait} мс: ` +
          `нет подтверждения, что блок разобран (${state ? `parser ${state.parser_block}, lag ${state.lag}, pending ${state.pending}` : 'Redis не ответил'})`
      );
      this.releaseWhere((a) => now - a.queued_at >= maxWait);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Остаток очереди выпускаем, а не теряем: действия уже сохранены.
    this.releaseWhere(() => true);
    await this.redis?.quit().catch(() => undefined);
  }

  private releaseWhere(predicate: (a: PendingAction) => boolean): void {
    for (let i = 0; i < this.queue.length; ) {
      const action = this.queue[i]!;
      if (predicate(action)) {
        this.queue.splice(i, 1);
        try {
          action.release();
        } catch (error: any) {
          this.logger.error(`Выпуск действия блока ${action.block_num} упал: ${error?.message ?? error}`, error?.stack);
        }
      } else {
        i++;
      }
    }
    if (!this.queue.length && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensureTicker(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.checking) return;
      this.checking = true;
      void this.tick().finally(() => {
        this.checking = false;
      });
    }, config.blockchain.action_release_poll_ms);
  }

  /**
   * Прогресс разбора: номер блока parser2 (`parser2:sync:<chain>`) и состояние
   * группы потребителя в стриме (`ce:parser2:<chain>:events`). Ключи — формат
   * parser2 1.9; не прочитали — null, сработает страховка.
   */
  private async readProgress(): Promise<StreamProgress | null> {
    try {
      const redis = this.client();
      const chain = config.blockchain.id;
      const [block, groups] = await Promise.all([
        redis.hget(`parser2:sync:${chain}`, 'block_num'),
        redis.xinfo('GROUPS', `ce:parser2:${chain}:events`) as Promise<unknown[]>,
      ]);
      const group = (groups ?? [])
        .map((g) => toRecord(g as unknown[]))
        .find((g) => g.name === `controller-${config.coopname}`);
      if (!block || !group) return null;
      return {
        parser_block: Number(block),
        pending: Number(group.pending ?? 0),
        lag: group.lag === null || group.lag === undefined ? null : Number(group.lag),
      };
    } catch {
      return null;
    }
  }

  private client(): Redis {
    if (!this.redis) {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        lazyConnect: false,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', () => undefined);
    }
    return this.redis;
  }
}

/** XINFO отдаёт плоский список «ключ, значение, ключ, значение…». */
function toRecord(flat: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = flat[i + 1];
  return out;
}
