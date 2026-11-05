import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import cron from 'node-cron';
import { isStandWorkerTurn, standWorkerPaceSeconds } from '@coopenomics/extension-kit';
import { GatewayInteractorPort, GATEWAY_INTERACTOR_PORT } from '~/domain/wallet/ports/gateway-interactor.port';

/**
 * Перевод истёкших платежей в статус EXPIRED по расписанию.
 *
 * Сервис прикладной, а не доменный: он ничего не решает про платежи, а по
 * часам зовёт сценарий шлюза. Пока он лежал в домене, домен зависел от
 * прикладного порта — и это ребро замыкало цикл модулей шлюза.
 */
/** Шаг обхода в работе — 10 минут; при сжатом времени стенда — шаг стенда. */
const EXPIRY_PACE_SECONDS = 600;

@Injectable()
export class GatewayExpiryCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GatewayExpiryCronService.name);
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly gatewayInteractorPort: GatewayInteractorPort
  ) {}

  onModuleInit() {
    // Просыпается каждую минуту, работает в свой черёд: в работе — раз в
    // 10 минут, на стенде со сжатым временем — по шагу стенда, чтобы взнос
    // истекал в сжатые сутки, а не на 10 минут позже.
    this.cronJob = cron.schedule('* * * * *', async () => {
      if (!isStandWorkerTurn(EXPIRY_PACE_SECONDS)) return;
      const count = await this.gatewayInteractorPort.expireOutdatedPayments();
      if (count > 0) {
        this.logger.log(`Истекло ${count} платежей (переведены в статус EXPIRED) через node-cron`);
      }
    });
    this.logger.log(`node-cron для expireOutdatedPayments запущен (шаг ${standWorkerPaceSeconds(EXPIRY_PACE_SECONDS)} с)`);
  }

  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.log('node-cron для expireOutdatedPayments остановлен');
    }
  }
}
