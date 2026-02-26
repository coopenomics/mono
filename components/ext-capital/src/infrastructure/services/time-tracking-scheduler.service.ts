import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as cron from 'node-cron';
import { TimeTrackingInteractor } from '../../application/use-cases/time-tracking.interactor';
import { config } from '~/config';

/**
 * Сервис планировщика для автоматического учёта времени
 * Управляет cron задачами для периодического выполнения учёта времени
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
    this.logger.log('Инициализация планировщика учёта времени...');

    // Запускаем учёт времени каждый час (или каждую минуту в dev режиме)
    const cronExpression = config.env === 'development' ? '* * * * *' : '0 * * * *';
    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await this.timeTrackingInteractor.trackTime();
      } catch (error) {
        this.logger.error('Ошибка в задаче учёта времени по расписанию', error);
      }
    });

    // Также выполняем первичный учёт времени при запуске
    try {
      await this.timeTrackingInteractor.trackTime();
    } catch (error) {
      this.logger.warn(
        'Первичный учёт времени не удался, будет повторена попытка при следующем запуске по расписанию',
        error
      );
    }

    this.logger.log('Планировщик учёта времени успешно инициализирован');
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
