import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BillingContract } from 'cooptypes';
import config from '~/config/config';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { BillingProviderClient } from './billing-provider.client';

/**
 * Single-Hub v5 (Story 12.11, проект «Облачный провайдер») — реактивный мост
 * on-chain → провайдер для time-оплат подписок.
 *
 * Ловит событие шины `action::billing::pay` (списание членских взносов с
 * биллинг-кошелька за подписки) и пересылает подтверждение провайдеру через
 * {@link BillingProviderClient.confirmPayment} — тот переводит invoice в PAID
 * и продлевает подписки.
 *
 * Это ВТОРОЙ путь подтверждения: первый — синхронный confirm в
 * BillingCronService сразу после transact. Дублирование намеренное (провайдер
 * идемпотентен по `payment_hash`): если backend упал между transact и
 * подтверждением, факт оплаты доносит парсер; если парсер завис — синхронный
 * confirm уже прошёл. Повторного списания средств при любом сценарии не
 * происходит — контракт billing отклоняет повтор `payment_hash` (anti-replay).
 *
 * Включается только на хабе (Восход, BILLING_HUB_MODE=true): на спицах
 * BillingModule не подключается вовсе.
 *
 * ⚠️ Ограничение шины (как у BillingConversionListener): эмит `action::` идёт
 * с задержкой ПОСЛЕ ACK сообщения, при падении хаба в этом окне реактивное
 * уведомление теряется. Для pay это не критично: при следующем тике cron
 * контракт ответит «уже проведён», и тик отправит подтверждение сам.
 */
@Injectable()
export class BillingPaymentListener {
  private readonly logger = new Logger(BillingPaymentListener.name);

  constructor(private readonly providerClient: BillingProviderClient) {}

  @OnEvent(
    `action::${BillingContract.contractName.production}::${BillingContract.Actions.Pay.actionName}`,
  )
  async onPay(action: ActionDomainInterface): Promise<void> {
    // Defense-in-depth: BillingModule и так грузится лишь на хабе.
    if (!config.billing.hub_mode) return;
    if (!this.providerClient.isConfigured()) {
      this.logger.warn('billing::pay: provider_base_url не сконфигурирован — пропуск');
      return;
    }

    try {
      const data: any = action.data ?? {};
      const paymentHash = String(data.payment_hash ?? '');
      const txId = String(action.transaction_id ?? '');

      if (!paymentHash) {
        this.logger.warn('billing::pay: пустой payment_hash в событии — пропуск');
        return;
      }

      await this.providerClient.confirmPayment({
        paymentHash,
        blockchainTransactionId: txId,
      });
    } catch (err: any) {
      // Не пробрасываем: on-chain состояние уже консистентно, подтверждение
      // продублирует синхронный путь cron'а (см. docstring класса).
      this.logger.error(`billing::pay → provider: ${err?.message}`, err?.stack);
    }
  }
}
