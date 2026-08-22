import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BillingContract } from 'cooptypes';
import config from '~/config/config';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { BillingProviderClient } from './billing-provider.client';
import { BillingPaymentLogService } from './billing-payment-log.service';

/**
 * Epic 13 v5.1 (проект «Облачный провайдер») — реактивный мост on-chain → провайдер для аренды вычислительных ресурсов (PowerUp).
 *
 * Ловит событие шины `action::billing::converttoaxn` (членский взнос → AXON,
 * бездокументарно; см. {@link BillingContract.Actions.ConvertToAxn}),
 * пересылает факт провайдеру через {@link BillingProviderClient.confirmTopupAxon}
 * и доводит запись PG-журнала платежей до CONFIRMED.
 *
 * Докупку инициирует и подписывает сам хаб (BillingCronService.processPackageTopup,
 * `_provider` — решение @ant 2026-06-11), поэтому листенер — страховочный
 * контур: он дозакрывает платежи, зависшие в SUBMITTING (backend упал между
 * transact и callback провайдеру), и фиксирует конвертации, проведённые вне
 * cron'а (онбординговые/ручные). Шина `action::` — единая точка для обоих
 * парсеров (легаси `components/parser` и `@coopenomics/parser2`), поэтому
 * листенер от парсера не зависит.
 *
 * Включается только на хабе (Воскход, BILLING_HUB_MODE=true): на спицах
 * BillingModule не подключается вовсе, а сам провайдер есть только у хаба.
 * Ошибки наружу НЕ пробрасываем — автономность кооператива важнее: on-chain
 * состояние (BURN членского + powerup) уже консистентно, а провайдеру теряется
 * лишь учётная запись invoice/Payment. Идемпотентность повторной доставки
 * гарантирует сам провайдер (200 OK на повтор по `payment_hash`).
 *
 * ⚠️ Ограничение: эмит шины `action::` идёт с задержкой ПОСЛЕ ACK сообщения
 * (см. BlockchainConsumerService.processActionDelayed), поэтому при падении
 * хаб-coopback'а в окне между ACK и эмитом уведомление провайдеру теряется
 * безвозвратно — реплея сохранённого billing-action в шину сейчас нет.
 * Для hub-инициированных докупок это окно закрыто PG-журналом: запись
 * SUBMITTED донесёт подтверждение сам hub-cron на следующем тике
 * (handleExistingPackageTopup); потеря эмита критична только для конвертаций
 * вне cron'а.
 */
@Injectable()
export class BillingConversionListener {
  private readonly logger = new Logger(BillingConversionListener.name);

  constructor(
    private readonly providerClient: BillingProviderClient,
    private readonly paymentLog: BillingPaymentLogService,
  ) {}

  @OnEvent(
    `action::${BillingContract.contractName.production}::${BillingContract.Actions.ConvertToAxn.actionName}`,
  )
  async onConvertToAxn(action: ActionDomainInterface): Promise<void> {
    // Defense-in-depth: BillingModule и так грузится лишь на хабе, но не шлём
    // ничего провайдеру, если узел оказался не в hub-режиме.
    if (!config.billing.hub_mode) return;
    if (!this.providerClient.isConfigured()) {
      this.logger.warn('converttoaxn: provider_base_url не сконфигурирован — пропуск');
      return;
    }

    const parsed = this.parseConvertToAxn(action);
    if (!parsed) return;

    try {
      await this.providerClient.confirmTopupAxon({
        paymentHash: parsed.paymentHash,
        blockchainTransactionId: parsed.txId,
        coopname: parsed.coopname,
        amountRub: parsed.amountRub,
      });
      // Дозакрываем PG-журнал: конвертация точно в блоке. Если записи нет
      // (конвертация вне hub-cron'а) — no-op.
      await this.paymentLog.markConfirmed(parsed.paymentHash, parsed.txId);
    } catch (err: any) {
      this.logger.error(`converttoaxn → provider: ${err?.message}`, err?.stack);
      // намеренно не пробрасываем — см. docstring класса
    }
  }

  /** Поля action'а converttoaxn; null (с warn) при неполных данных. */
  private parseConvertToAxn(
    action: ActionDomainInterface,
  ): { coopname: string; paymentHash: string; amountRub: number; txId: string } | null {
    const data: any = action.data ?? {};
    const coopname = String(data.coopname ?? '');
    const paymentHash = String(data.payment_hash ?? '');
    const amountRub = this.parseAssetAmount(data.amount);
    if (!coopname || !paymentHash || amountRub == null) {
      this.logger.warn(
        `converttoaxn: неполные данные (coop=${coopname}, hash=${paymentHash}, amount=${String(data.amount)}) — пропуск`,
      );
      return null;
    }
    return { coopname, paymentHash, amountRub, txId: String(action.transaction_id ?? '') };
  }

  /**
   * Парсит on-chain asset вида "1500.0000 RUB" в число рублей (1500).
   * Возвращает null, если формат не распознан.
   */
  private parseAssetAmount(asset: unknown): number | null {
    if (typeof asset !== 'string') return null;
    const n = parseFloat(asset.split(' ')[0]);
    return Number.isFinite(n) ? n : null;
  }
}
