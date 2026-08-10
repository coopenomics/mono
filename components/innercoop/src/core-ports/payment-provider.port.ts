import type { InnerPaymentDetails } from './payment.port';

/**
 * Реестр способов оплаты.
 *
 * Расширение-провайдер (эквайринг, СБП, касса банка) кладёт себя в реестр при
 * запуске, а расчётный контур ядра достаёт его оттуда по имени, когда пайщик
 * выбрал этот способ. Раньше расширение инжектило `PROVIDER_PORT` по пути
 * `~/domain/gateway`, которого за пределами монолита нет.
 *
 * Регистрация — единственный способ появиться в списке способов оплаты: ядро
 * не знает провайдеров по именам заранее.
 */

/**
 * Способ оплаты со стороны расширения — то, что ядро вызывает у провайдера.
 *
 * Уведомление банка о платеже (IPN) провайдер принимает сам своим маршрутом,
 * поэтому в контракте его нет: ядро туда не ходит.
 */
export interface IPaymentProvider {
  /**
   * Выдать реквизиты для оплаты заведённого платежа: QR-код, ссылку на форму
   * эквайринга или банковские реквизиты — что именно, решает провайдер.
   */
  createPayment(hash: string): Promise<InnerPaymentDetails>;
}

export interface IPaymentProviderRegistryPort {
  /** Имя обязано совпадать с тем, под которым способ оплаты предлагается пайщику. */
  registerProvider(name: string, provider: IPaymentProvider): void;

  getProvider(name: string): IPaymentProvider | undefined;
}

export const PAYMENT_PROVIDER_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.PaymentProviderRegistry');
