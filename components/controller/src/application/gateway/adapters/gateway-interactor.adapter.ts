import { Injectable } from '@nestjs/common';
import { GatewayInteractor } from '~/application/gateway/interactors/gateway.interactor';
import { GatewayInteractorPort } from '~/domain/wallet/ports/gateway-interactor.port';
import type { CreateInitialPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-initial-payment-input-domain.interface';
import type { CreateDepositPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-deposit-payment-input-domain.interface';
import type { CreateWithdrawInputDomainInterface } from '~/domain/wallet/interfaces/create-withdraw-input-domain.interface';
import type { SetPaymentStatusInputDomainInterface } from '~/domain/gateway/interfaces/set-payment-status-domain-input.interface';
import type { InternalPaymentFiltersDomainInterface } from '~/domain/gateway/interfaces/payment-filters-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaymentDomainEntity } from '~/domain/gateway/entities/payment-domain.entity';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';

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
