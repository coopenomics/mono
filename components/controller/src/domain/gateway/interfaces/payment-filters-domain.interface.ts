import type { PaymentStatusEnum } from '../enums/payment-status.enum';
import type { PaymentTypeEnum, PaymentDirectionEnum } from '../enums/payment-type.enum';

/**
 * Доменный интерфейс для фильтрации платежей (внешний API)
 * Не содержит sensitive данные как secret
 */
export interface PaymentFiltersDomainInterface {
  coopname?: string;
  username?: string;
  status?: PaymentStatusEnum;
  type?: PaymentTypeEnum;
  direction?: PaymentDirectionEnum;
  provider?: string;
  hash?: string;
  proposal_hash?: string;
}

/**
 * Расширенный доменный интерфейс для внутренней фильтрации платежей
 * Содержит все поля включая sensitive данные
 */
export interface InternalPaymentFiltersDomainInterface extends PaymentFiltersDomainInterface {
  secret?: string;
}

/**
 * Доменный интерфейс для создания платежа
 */
export interface CreatePaymentDomainInterface {
  coopname: string;
  username: string;
  quantity: string;
  symbol: string;
  type: PaymentTypeEnum;
  provider?: string;
  payment_method_id?: string;
  memo?: string;
  expired_at?: Date;
  statement?: any;
}

/**
 * Доменный интерфейс для обновления статуса платежа
 */
export interface UpdatePaymentStatusDomainInterface {
  id: string;
  status: PaymentStatusEnum;
  message?: string;
}
