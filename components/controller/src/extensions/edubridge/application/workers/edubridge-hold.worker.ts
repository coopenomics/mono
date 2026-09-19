import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';

/**
 * Очередь отложенных заявлений преподавателя. Заявление подписывается вместе с
 * отчётом о занятии и держится, пока идёт гарантийный срок материалов; когда
 * срок истёк, оно уходит в совет само — повторных действий от преподавателя
 * это не требует.
 */
@Injectable()
export class EdubridgeHoldWorker {
  constructor(
    private readonly teachers: EdubridgeTeacherService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeHoldWorker.name);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async publishDue(): Promise<void> {
    const coopname = platformSettings().coopname;
    try {
      const published = await this.teachers.publishDueContributions(coopname);
      if (published > 0) this.logger.info(`[EDU.RID] отправлено в совет заявлений по истечении гарантийного срока: ${published}`);
    } catch (e) {
      this.logger.error(`[EDU.RID] очередь отложенных заявлений: ${(e as Error)?.message ?? e}`);
    }
  }
}
