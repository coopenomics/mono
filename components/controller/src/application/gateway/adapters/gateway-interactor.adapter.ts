import { Injectable } from '@nestjs/common';
import { GatewayInteractor } from '~/application/gateway/interactors/gateway.interactor';
import { GatewayInteractorPort } from '~/domain/wallet/ports/gateway-interactor.port';
import type { CreateInitialPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-initial-payment-input-domain.interface';
import type { CreateDepositPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-deposit-payment-input-domain.interface';
import type { CreateWithdrawInputDomainInterface } from '~/domain/wallet/interfaces/create-withdraw-input-domain.interface';
import type { CreateSystemOutgoingPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-system-outgoing-payment-input-domain.interface';
import type { SetPaymentStatusInputDomainInterface } from '~/domain/gateway/interfaces/set-payment-status-domain-input.interface';
import type { InternalPaymentFiltersDomainInterface } from '~/domain/gateway/interfaces/payment-filters-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaymentDomainEntity } from '~/domain/gateway/entities/payment-domain.entity';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';

@Injectable()
export class GatewayInteractorAdapter implements GatewayInteractorPort {
  constructor(private readonly gatewayInteractor: GatewayInteractor) {}

  async getPayments(
    filters: InternalPaymentFiltersDomainInterface,
    options: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<PaymentDomainEntity>> {
    return await this.gatewayInteractor.getPayments(filters, options);
  }

  async createInitialPayment(data: CreateInitialPaymentInputDomainInterface): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractor.createInitialPayment(data);
  }

  async createDeposit(data: CreateDepositPaymentInputDomainInterface): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractor.createDeposit(data);
  }

  async createWithdraw(data: CreateWithdrawInputDomainInterface): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractor.createWithdraw(data);
  }

  async createSystemOutgoingPayment(
    data: CreateSystemOutgoingPaymentInputDomainInterface
  ): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractor.createSystemOutgoingPayment(data);
  }

  async prepareWithdraw(data: CreateWithdrawInputDomainInterface): Promise<PaymentDomainInterface> {
    return await this.gatewayInteractor.prepareWithdraw(data);
  }

  async persistWithdraw(paymentData: PaymentDomainInterface): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractor.persistWithdraw(paymentData);
  }

  async setPaymentStatus(data: SetPaymentStatusInputDomainInterface): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractor.setPaymentStatus(data);
  }

  async executeIncomePayment(id: string, status: PaymentStatusEnum): Promise<void> {
    return await this.gatewayInteractor.executeIncomePayment(id, status);
  }

  async expireOutdatedPayments(): Promise<number> {
    return await this.gatewayInteractor.expireOutdatedPayments();
  }
}
