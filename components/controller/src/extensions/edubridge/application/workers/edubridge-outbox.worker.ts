import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EdubridgeAccessOutboxService } from '../services/edubridge-access-outbox.service';

/** Воркер очереди: интервал ≤ 30 с (NFR5 — до минуты от взноса до приглашения). */
@Injectable()
export class EdubridgeOutboxWorker {
  private running = false;

  constructor(
    private readonly outbox: EdubridgeAccessOutboxService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeOutboxWorker.name);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    if (this.running) return;
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    this.running = true;
    try {
      // Пока есть срочные задачи — выбираем пачками, не дожидаясь следующего тика.
      let processed = 0;
      for (let i = 0; i < 10; i += 1) {
        const n = await this.outbox.processDue(coopname);
        processed += n;
        if (n === 0) break;
      }
      if (processed) this.logger.info(`[EDU.OUTBOX] обработано задач: ${processed}`);
    } catch (e) {
      this.logger.error(`[EDU.OUTBOX] сбой воркера: ${(e as Error)?.message ?? e}`);
    } finally {
      this.running = false;
    }
  }
}
