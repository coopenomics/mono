import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as cron from 'node-cron';
import { TimeTrackingInteractor } from '../../application/use-cases/time-tracking.interactor';

/**
 * Планировщик: авто-стоп открытых таймеров по суточному лимиту hours_per_day.
 */
@Injectable()
export class TimeTrackingSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimeTrackingSchedulerService.name);
  private cronJob: cron.ScheduledTask | null = null;

  constructor(private readonly timeTrackingInteractor: TimeTrackingInteractor) {}

  /**
   * Инициализация сервиса при старте модуля
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(
      'Планировщик учёта времени: авто-стоп таймеров по hours_per_day (авто-билеты отключены, 562-14).'
    );

    // Раз в минуту — чтобы суточный лимит резал таймер без долгой задержки
    const cronExpression = '* * * * *';
    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await this.timeTrackingInteractor.trackTime();
      } catch (error) {
        this.logger.error('Ошибка в задаче учёта времени по расписанию', error);
      }
    });
  }

  /**
   * Остановка сервиса
   */
  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.log('Планировщик учёта времени остановлен');
    }
  }

  onModuleDestroy() {
    return this.stop();
  }
}
