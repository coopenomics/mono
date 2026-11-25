import type { PaymentDetailsDomainInterface } from '../interfaces/payment-domain.interface';

/**
 * Порт для платежных провайдеров
 * Определяет интерфейс взаимодействия с платежными провайдерами
 */
export interface PaymentProviderPort {
  /** Процент толерантности к сумме платежа */
  tolerance_percent: number;

  /** Процент комиссии */
  fee_percent: number;

  /** Создание платежа по хэшу */
  createPayment(hash: string): Promise<PaymentDetailsDomainInterface>;

  /**
   * Вернуть плательщику деньги отклоняемого входящего платежа. Метод есть только
   * у провайдера, который сам принимает деньги (эквайринг ЮKassa); у оплаты по
   * реквизитам деньги возвращает кассир. Сбой — исключение: платёж тогда не
   * отклоняется, и кассир видит причину.
   */
  refundPayment?(hash: string): Promise<ProviderRefundResultDomainInterface>;
}

/** Итог возврата у провайдера. */
export interface ProviderRefundResultDomainInterface {
  /** `false` — оплаты у провайдера не было, возвращать нечего. */
  refunded: boolean;
  /** Возвращённая сумма, например `932.64 RUB`. */
  amount?: string;
}

/**
 * Порт для IPN провайдеров (Instant Payment Notification)
 */
export interface IPNProviderPort extends PaymentProviderPort {
  /** Обработка IPN уведомления */
  handleIPN(request: any): Promise<void>;
}

/**
 * Порт для Polling провайдеров (проверка статуса платежа через опрос)
 */
export interface PollingProviderPort extends PaymentProviderPort {
  /** Синхронизация платежей */
  sync(): Promise<void>;
}

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');
export const IPN_PROVIDER_PORT = Symbol('IPN_PROVIDER_PORT');
export const POLLING_PROVIDER_PORT = Symbol('POLLING_PROVIDER_PORT');
