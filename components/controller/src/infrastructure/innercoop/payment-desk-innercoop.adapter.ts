import { Inject, Injectable } from '@nestjs/common';
import type {
  IPaymentDeskPort,
  InnerPage,
  InnerPageRequest,
  InnerPayment,
  InnerPaymentFilters,
  InnerSetPaymentStatusInput,
  InnerSystemOutgoingPaymentInput,
} from '@coopenomics/innercoop';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { RoleAssignmentsRegistry } from '~/application/access-roles/role-assignments.registry';
import { cashDeskConfirmers } from '~/application/rights/cash-desk-confirmers';
import {
  GATEWAY_INTERACTOR_PORT,
  type GatewayInteractorPort,
} from '~/domain/wallet/ports/gateway-interactor.port';

/**
 * Реализация `IPaymentDeskPort` поверх кассирского контура ядра.
 *
 * Открывает расширениям три операции из большого интерактора — выборку,
 * смену состояния и системную выплату, — и перечень тех, кто платежи
 * подтверждает. Остальное там завязано на заявления
 * пайщика и его платёжные методы: это работа ядра, не расширения.
 */
@Injectable()
export class PaymentDeskInnercoopAdapter implements IPaymentDeskPort {
  constructor(
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly gatewayInteractor: GatewayInteractorPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    private readonly roleAssignments: RoleAssignmentsRegistry
  ) {}

  async getPayments(filters: InnerPaymentFilters, page: InnerPageRequest): Promise<InnerPage<InnerPayment>> {
    return this.gatewayInteractor.getPayments(filters, page);
  }

  async setPaymentStatus(input: InnerSetPaymentStatusInput): Promise<InnerPayment> {
    return this.gatewayInteractor.setPaymentStatus(input);
  }

  async createSystemOutgoingPayment(input: InnerSystemOutgoingPaymentInput): Promise<InnerPayment> {
    return this.gatewayInteractor.createSystemOutgoingPayment(input);
  }

  async confirmers(): Promise<string[]> {
    return cashDeskConfirmers(this.accounts, this.roleAssignments);
  }
}
