import { Inject, Injectable } from '@nestjs/common';
import type {
  IPaymentDeskPort,
  InnerPage,
  InnerPageRequest,
  InnerPayment,
  InnerPaymentFilters,
  InnerPayoutRequest,
  InnerSetPaymentStatusInput,
  InnerSystemOutgoingPaymentInput,
} from '@coopenomics/innercoop';
import type { PayoutRequestDomainInterface } from '~/domain/gateway/repositories/payout-request.repository';
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
 * Открывает расширениям операции из большого интерактора — выборку, смену
 * состояния, системную выплату и заявки на выплату по решению совета, — и
 * перечень тех, кто платежи подтверждает. Остальное там завязано на заявления
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

  async registerPayoutRequest(input: InnerSystemOutgoingPaymentInput): Promise<InnerPayoutRequest> {
    return toInnerPayoutRequest(await this.gatewayInteractor.registerSystemPayoutRequest(input));
  }

  async releasePayoutRequest(hash: string): Promise<InnerPayment | null> {
    return this.gatewayInteractor.releasePayoutRequest(hash);
  }

  async declinePayoutRequest(hash: string): Promise<void> {
    return this.gatewayInteractor.declinePayoutRequest(hash);
  }

  async dropPayoutRequest(hash: string): Promise<void> {
    return this.gatewayInteractor.dropPayoutRequest(hash);
  }

  async getPayoutRequest(hash: string): Promise<InnerPayoutRequest | null> {
    const request = await this.gatewayInteractor.getPayoutRequest(hash);
    return request ? toInnerPayoutRequest(request) : null;
  }

  async confirmers(): Promise<string[]> {
    return cashDeskConfirmers(this.accounts, this.roleAssignments);
  }
}

/** Заявка для расширения: сумма, реквизиты и состояние, без служебных полей узла. */
function toInnerPayoutRequest(request: PayoutRequestDomainInterface): InnerPayoutRequest {
  return {
    hash: request.hash,
    coopname: request.coopname,
    username: request.username,
    quantity: request.quantity,
    symbol: request.symbol,
    type: request.type,
    payment_method_id: request.payment_method_id ?? null,
    status: request.status,
    created_at: request.created_at,
    decided_at: request.decided_at ?? null,
  };
}
