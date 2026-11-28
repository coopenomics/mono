import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import config from '~/config/config';
import { BILLING_TANK_BALANCE_EVENT, type BillingTankBalancePayload } from '~/domain/billing/events/tank-balance.event';
import { BillingCronService } from '~/domain/billing/services/billing-cron.service';

/**
 * Слушатель остатка AXON кооперативов на узле-хабе (28.11.2026).
 *
 * Разбор цепи объявляет событие на каждое изменение остатка токена. Остаток
 * ниже порога у действующего кооператива — хаб пополняет бак сразу, не
 * дожидаясь планового такта. Сам слушатель ничего не решает и разбор цепи не
 * держит: пополнение идёт без ожидания, отказ остаётся в журнале.
 */
@Injectable()
export class BillingTankListener {
  private readonly logger = new Logger(BillingTankListener.name);

  constructor(private readonly cron: BillingCronService) {}

  @OnEvent(BILLING_TANK_BALANCE_EVENT)
  onTankBalance(payload: BillingTankBalancePayload): void {
    // Модуль биллинга грузится только на хабе; проверка — страховка от запуска вне его.
    if (!config.billing.hub_mode) return;
    void this.cron
      .onTankBalance(payload.coopname, payload.balance)
      .catch((e: unknown) => this.logger.error(`tank balance handler failed: ${e instanceof Error ? e.message : String(e)}`));
  }
}
