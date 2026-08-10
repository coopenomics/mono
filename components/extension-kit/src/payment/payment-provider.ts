import { Injectable } from '@nestjs/common';
import { BaseExtensionModule } from '../base-extension.module';

/**
 * Сумма платежа в разбивке на тело и комиссию — то, что способ оплаты выдаёт
 * пайщику вместе с реквизитами.
 *
 * Форма намеренно повторяет `InnerPaymentDetails` из `@coopenomics/innercoop`,
 * а не импортируется оттуда: пакеты ортогональны и друг от друга не зависят
 * (INV-007). Совместимость структурная — так же сделаны `ISyncLogger` и
 * `SignedDigitalDocumentInputDTO`.
 */
export interface PaymentDetails {
  /** Реквизиты, QR-код или токен провайдера — форма зависит от способа оплаты. */
  data: any;
  amount_plus_fee: string;
  amount_without_fee: string;
  fee_amount: string;
  fee_percent: number;
  fact_fee_percent: number;
  tolerance_percent: number;
}

/**
 * Базовый класс расширения-способа оплаты.
 *
 * Наследуется расширением, которое умеет выставлять счёт: эквайринг, СБП,
 * касса банка. Само расширение кладёт себя в реестр способов оплаты при
 * запуске, а расчётный контур ядра вызывает у него `createPayment`, когда
 * пайщик выбрал этот способ.
 *
 * `tolerance_percent` — допустимое отклонение пришедшей суммы от ожидаемой:
 * банк может округлить или удержать свою комиссию, и платёж на копейку меньше
 * обязан приниматься. `fee_percent` — комиссия способа оплаты, она добавляется
 * к сумме и оплачивается сверх.
 */
@Injectable()
export abstract class PaymentProvider extends BaseExtensionModule {
  public abstract tolerance_percent: number;
  public abstract fee_percent: number;
  public abstract createPayment(hash: string): Promise<PaymentDetails>;
}
