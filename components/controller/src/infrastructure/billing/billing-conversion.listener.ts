import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BillingContract } from 'cooptypes';
import config from '~/config/config';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { BillingProviderClient } from './billing-provider.client';

/**
 * Epic 13 v5.1 — реактивный мост on-chain → провайдер для пакетного PowerUp.
 *
 * Ловит событие шины `action::billing::converttoaxn` (членский взнос → AXON,
 * бездокументарно; см. {@link BillingContract.Actions.ConvertToAxn}) и
 * пересылает факт провайдеру через {@link BillingProviderClient.confirmTopupAxon}.
 *
 * Почему так, а не push из PowerupPlugin: провайдер обязан оставаться
 * необязательным на горячем пути — кооператив-спица подписывает и шлёт
 * `converttoaxn` сам (coopname@active), даже если провайдер лежит. Провайдер
 * узнаёт о конвертации РЕАКТИВНО, из блокчейна, а не синхронным вызовом. Шина
 * `action::` — единая точка для обоих парсеров (легаси `components/parser` и
 * `@coopenomics/parser2`), поэтому листенер от парсера не зависит.
 *
 * Включается только на хабе (Воскход, BILLING_HUB_MODE=true): на спицах
 * BillingModule не подключается вовсе, а сам провайдер есть только у хаба.
 * Ошибки наружу НЕ пробрасываем — автономность кооператива важнее, провайдер
 * до-сверится реконсиляцией. Идемпотентность гарантирует сам провайдер
 * (200 OK на повтор по `payment_hash`).
 */
@Injectable()
export class BillingConversionListener {
  private readonly logger = new Logger(BillingConversionListener.name);

  constructor(private readonly providerClient: BillingProviderClient) {}

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

    try {
      const data: any = action.data ?? {};
      const coopname = String(data.coopname ?? '');
      const paymentHash = String(data.payment_hash ?? '');
      const amountRub = this.parseAssetAmount(data.amount);
      const txId = String(action.transaction_id ?? '');

      if (!coopname || !paymentHash || amountRub == null) {
        this.logger.warn(
          `converttoaxn: неполные данные (coop=${coopname}, hash=${paymentHash}, amount=${String(data.amount)}) — пропуск`,
        );
        return;
      }

      await this.providerClient.confirmTopupAxon({
        paymentHash,
        blockchainTransactionId: txId,
        coopname,
        amountRub,
      });
    } catch (err: any) {
      this.logger.error(`converttoaxn → provider: ${err?.message}`, err?.stack);
      // намеренно не пробрасываем — см. docstring класса
    }
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
