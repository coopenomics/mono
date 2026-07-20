import type { PaymentStatusEnum } from '../enums/payment-status.enum';

export interface SetPaymentStatusInputDomainInterface {
  id: string;
  status: PaymentStatusEnum;
  /** Причина изменения статуса (например, причина отклонения платежа), сохраняется в payment.message */
  message?: string;
}
