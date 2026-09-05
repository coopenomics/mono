import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EXTENSION_REPOSITORY, platformSettings, type ExtensionDomainRepository } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { ROBOT_EXTENSION_NAME } from '../../domain/constants';
import { ROBOT_ACTIVE_STAGES, RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';
import type { RobotDecisionDomainEntity } from '../../domain/entities/robot-decision.entity';
import { ROBOT_DECISION_REPOSITORY, type RobotDecisionRepository } from '../../domain/repositories/robot-decision.repository';
import { RobotDecisionService, type RobotLimits } from './robot-decision.service';

/** Настройки робота из конфига расширения. */
export interface RobotConfig extends RobotLimits {
  enabled?: boolean;
}

/**
 * Сторож: раз в несколько секунд перебирает решения в работе и дожимает
 * зависшие — не отправленные голоса, не собранный протокол, не прошедшую
 * транзакцию. Один проход за раз; параллельные тики пропускаются.
 */
@Injectable()
export class RobotWatchdogService {
  private static readonly TICK_MS = 5000;
  private static readonly BATCH = 20;
  private readonly coopname = platformSettings().coopname;
  private running = false;
  private wake: Set<RobotDecisionStage> = new Set();
  /** Проходы в работе по решениям и по одному добавочному проходу, поставленному вслед. */
  private readonly inflight = new Map<string, Promise<RobotDecisionDomainEntity>>();
  private readonly queued = new Map<string, Promise<RobotDecisionDomainEntity>>();

  constructor(
    @Inject(ROBOT_DECISION_REPOSITORY) private readonly journal: RobotDecisionRepository,
    @Inject(EXTENSION_REPOSITORY) private readonly extensions: ExtensionDomainRepository<RobotConfig>,
    private readonly decisions: RobotDecisionService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(RobotWatchdogService.name);
  }

  /** Расширение установлено и включено в кооперативе. */
  async isEnabled(): Promise<boolean> {
    const extension = await this.extensions.findByName(ROBOT_EXTENSION_NAME);
    return !!extension && extension.enabled !== false;
  }

  async limits(): Promise<RobotLimits> {
    const extension = await this.extensions.findByName(ROBOT_EXTENSION_NAME);
    const config = (extension?.config ?? {}) as Partial<RobotConfig>;
    return {
      max_attempts: Math.max(1, Number(config.max_attempts ?? 5)),
      retry_backoff_sec: Math.max(1, Number(config.retry_backoff_sec ?? 5)),
    };
  }

  /** Немедленная обработка записи (по событию), вне очереди сторожа. */
  async processNow(entry: RobotDecisionDomainEntity): Promise<RobotDecisionDomainEntity> {
    return this.processLocked(entry);
  }

  /**
   * Одно решение — один проход за раз. Каждый голос по решению будит робота, и
   * три голоса одной транзакции приходят тремя событиями разом; два параллельных
   * прохода подали бы второй голос или второй протокол и затёрли бы этап друг
   * друга. Событие во время прохода ставит один добавочный проход после текущего,
   * остальные события ждут его же. Проход всегда берёт свежую запись из журнала.
   */
  async processLocked(entry: RobotDecisionDomainEntity): Promise<RobotDecisionDomainEntity> {
    const key = `${entry.coopname}:${entry.decision_id}`;
    const current = this.inflight.get(key);
    if (!current) return this.runFresh(key, entry);
    const queued = this.queued.get(key);
    if (queued) return queued;
    const next = current
      .catch(() => entry)
      .then(() => {
        this.queued.delete(key);
        return this.runFresh(key, entry);
      });
    this.queued.set(key, next);
    return next;
  }

  private runFresh(key: string, entry: RobotDecisionDomainEntity): Promise<RobotDecisionDomainEntity> {
    const run = (async () => {
      const latest = (await this.journal.findByDecision(entry.coopname, entry.decision_id)) ?? entry;
      return this.decisions.process(latest, await this.limits());
    })();
    this.inflight.set(key, run);
    return run.finally(() => {
      if (this.inflight.get(key) === run) this.inflight.delete(key);
    });
  }

  /** Разбудить записи в этапе на ближайшем тике (например, после делегирования председателя). */
  wakeStage(stage: RobotDecisionStage): void {
    this.wake.add(stage);
  }

  /** Ручной повтор застрявшего решения администратором. */
  async retry(decision_id: number): Promise<RobotDecisionDomainEntity | null> {
    const entry = await this.journal.findByDecision(this.coopname, decision_id);
    if (!entry) return null;
    entry.attempts = 0;
    entry.last_error = null;
    entry.next_attempt_at = null;
    if (entry.stage === RobotDecisionStage.FAILED) entry.stage = RobotDecisionStage.NEW;
    await this.journal.save(entry);
    return this.processLocked(entry);
  }

  @Interval(RobotWatchdogService.TICK_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.isEnabled())) return;
      const now = new Date();
      const due = await this.journal.findDue(this.coopname, ROBOT_ACTIVE_STAGES, now, RobotWatchdogService.BATCH);
      const woken = this.wake;
      this.wake = new Set();
      // Записи в промежуточных этапах дожимаются, если подошло время повтора
      // либо этап разбужен событием; свежие записи (моложе тика) не трогаем —
      // ими занимается обработчик события.
      const stale = due.filter(
        (d) => woken.has(d.stage) || now.getTime() - new Date(d.updated_at).getTime() >= RobotWatchdogService.TICK_MS
      );
      for (const entry of stale) {
        await this.processLocked(entry);
      }
    } catch (e: any) {
      this.logger.error(`Сторож робота: ${e?.message}`, e?.stack);
    } finally {
      this.running = false;
    }
  }
}
