import type { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';

/**
 * Сводка по регистрационному (вступительному) платежу пайщика.
 * Прокидывается в аккаунт, чтобы фронт восстанавливал шаг регистрации
 * (ожидание/отклонение платежа) после перезагрузки и в любой вкладке.
 */
export interface RegistrationPaymentDomainInterface {
  status: PaymentStatusEnum;
  /** Причина изменения статуса (например, причина отклонения платежа) */
  message?: string | null;
  hash: string;
  quantity: number;
  symbol: string;
}
