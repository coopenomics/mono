import type { CreateInitialPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-initial-payment-input-domain.interface';
import type { CreateDepositPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-deposit-payment-input-domain.interface';
import type { CreateWithdrawInputDomainInterface } from '~/domain/wallet/interfaces/create-withdraw-input-domain.interface';
import type { PrepareInvestmentInputDomainInterface } from '~/domain/gateway/interfaces/prepare-investment-input-domain.interface';
import type { SetPaymentStatusInputDomainInterface } from '~/domain/gateway/interfaces/set-payment-status-domain-input.interface';
import type { InternalPaymentFiltersDomainInterface } from '~/domain/gateway/interfaces/payment-filters-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaymentDomainEntity } from '~/domain/gateway/entities/payment-domain.entity';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';

export interface GatewayInteractorPort {
  getPayments(
    filters: InternalPaymentFiltersDomainInterface,
    options: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<PaymentDomainEntity>>;
  createInitialPayment(data: CreateInitialPaymentInputDomainInterface): Promise<PaymentDomainEntity>;
  createDeposit(data: CreateDepositPaymentInputDomainInterface): Promise<PaymentDomainEntity>;
  createWithdraw(data: CreateWithdrawInputDomainInterface): Promise<PaymentDomainEntity>;

  /**
   * Подготовить (с валидацией) исходящий платеж к созданию БЕЗ записи в БД.
   * Парный метод к persistWithdraw — даёт вызывающему провести on-chain
   * транзакцию между валидацией и фиксацией платежа.
   */
  prepareWithdraw(data: CreateWithdrawInputDomainInterface): Promise<PaymentDomainInterface>;

  /**
   * Подготовить (с валидацией) исходящий платеж по инвестированию средств
   * кооператива в ЦПП оператора платформы БЕЗ записи в БД.
   * Реквизиты получателя — кооператив-оператор, не платёжный метод пайщика.
   */
  prepareInvestment(data: PrepareInvestmentInputDomainInterface): Promise<PaymentDomainInterface>;

  /**
   * Зафиксировать в БД ранее подготовленный исходящий платеж.
   * Вызывается только после успешной on-chain транзакции.
   */
  persistWithdraw(paymentData: PaymentDomainInterface): Promise<PaymentDomainEntity>;

  setPaymentStatus(data: SetPaymentStatusInputDomainInterface): Promise<PaymentDomainEntity>;

  /**
   * Выполнить процессинг платежа
   */
  executeIncomePayment(id: string, status: PaymentStatusEnum): Promise<void>;

  /**
   * Обновить все истекшие платежи в статус EXPIRED
   * @returns количество обновленных платежей
   */
  expireOutdatedPayments(): Promise<number>;
}

export const GATEWAY_INTERACTOR_PORT = Symbol('GatewayInteractorPort');
