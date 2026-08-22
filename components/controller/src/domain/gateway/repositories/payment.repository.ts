import type { PaymentStatusEnum } from '../enums/payment-status.enum';
import type { PaymentDomainInterface } from '../interfaces/payment-domain.interface';
import type { InternalPaymentFiltersDomainInterface } from '../interfaces/payment-filters-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaymentTypeEnum } from '../enums/payment-type.enum';

export interface PaymentRepository {
  // Общие методы
  findById(id: string): Promise<PaymentDomainInterface | null>;
  findByHash(hash: string): Promise<PaymentDomainInterface | null>;
  delete(id: string): Promise<boolean>;
  create(data: PaymentDomainInterface): Promise<PaymentDomainInterface>;
  update(id: string, data: Partial<PaymentDomainInterface>): Promise<PaymentDomainInterface | null>;

  // Методы для работы с платежами
  updatePaymentWithBlockchainData(hash: string, blockchain_data: any): Promise<PaymentDomainInterface | null>;
  setPaymentStatus(id: string, status: PaymentStatusEnum): Promise<PaymentDomainInterface | null>;

  // Универсальные методы
  getAllPayments(
    filters: InternalPaymentFiltersDomainInterface,
    options: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<PaymentDomainInterface>>;

  // Новые методы для работы с истекшими платежами
  /**
   * Обновить все истекшие платежи в статус EXPIRED
   * @returns количество обновленных платежей
   */
  expireOutdatedPayments(): Promise<number>;

  /**
   * Найти активный платеж того же типа для пользователя
   * @param username имя пользователя
   * @param type тип платежа
   * @param quantity количество
   * @param symbol символ валюты
   * @returns активный платеж или null
   */
  findActivePendingPayment(
    username: string,
    type: PaymentTypeEnum,
    quantity: number,
    symbol: string
  ): Promise<PaymentDomainInterface | null>;

  /**
   * Найти последний платеж заданного типа для пользователя (любой статус)
   * @param username имя пользователя
   * @param type тип платежа
   * @returns последний по дате создания платеж или null
   */
  findLatestByUsernameAndType(username: string, type: PaymentTypeEnum): Promise<PaymentDomainInterface | null>;
}

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');
