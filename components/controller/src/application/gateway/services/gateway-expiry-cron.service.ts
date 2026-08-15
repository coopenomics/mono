import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import cron from 'node-cron';
import { GatewayInteractorPort, GATEWAY_INTERACTOR_PORT } from '~/domain/wallet/ports/gateway-interactor.port';

/**
 * Перевод истёкших платежей в статус EXPIRED по расписанию.
 *
 * Сервис прикладной, а не доменный: он ничего не решает про платежи, а по
 * часам зовёт сценарий шлюза. Пока он лежал в домене, домен зависел от
 * прикладного порта — и это ребро замыкало цикл модулей шлюза.
 */
@Injectable()
export class GatewayExpiryCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GatewayExpiryCronService.name);
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly gatewayInteractorPort: GatewayInteractorPort
  ) {}

  onModuleInit() {
    // Запуск задачи раз в 10 минут
    this.cronJob = cron.schedule('*/10 * * * *', async () => {
      const count = await this.gatewayInteractorPort.expireOutdatedPayments();
      if (count > 0) {
        this.logger.log(`Истекло ${count} платежей (переведены в статус EXPIRED) через node-cron`);
      }
    });
    this.logger.log('node-cron для expireOutdatedPayments запущен (каждые 10 минут)');
  }

  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.log('node-cron для expireOutdatedPayments остановлен');
    }
  }
}
