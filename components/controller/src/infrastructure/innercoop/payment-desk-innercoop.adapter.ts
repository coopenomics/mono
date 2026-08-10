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
import {
  GATEWAY_INTERACTOR_PORT,
  type GatewayInteractorPort,
} from '~/domain/wallet/ports/gateway-interactor.port';

/**
 * Реализация `IPaymentDeskPort` поверх кассирского контура ядра.
 *
 * Открывает расширениям три операции из большого интерактора — выборку,
 * смену состояния и системную выплату. Остальное там завязано на заявления
 * пайщика и его платёжные методы: это работа ядра, не расширения.
 */
@Injectable()
export class PaymentDeskInnercoopAdapter implements IPaymentDeskPort {
  constructor(
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly gatewayInteractor: GatewayInteractorPort
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
}
