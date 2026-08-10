import { Inject, Injectable } from '@nestjs/common';
import type { IPaymentPollingStatePort, InnerPaymentPollingState } from '@coopenomics/innercoop';
import {
  PAYMENT_STATE_REPOSITORY,
  type PaymentStateRepository,
} from '~/domain/gateway/repositories/payment-state.repository';

/**
 * Реализация `IPaymentPollingStatePort`: метка прочитанного в банковской
 * выписке живёт в базе ядра, чтобы пережить перезапуск расширения.
 */
@Injectable()
export class PaymentPollingStateInnercoopAdapter implements IPaymentPollingStatePort {
  constructor(
    @Inject(PAYMENT_STATE_REPOSITORY)
    private readonly paymentStateRepository: PaymentStateRepository
  ) {}

  async find(accountNumber: string, statementDate: string): Promise<InnerPaymentPollingState | null> {
    return this.paymentStateRepository.findOne(accountNumber, statementDate);
  }

  async save(state: InnerPaymentPollingState): Promise<InnerPaymentPollingState> {
    return this.paymentStateRepository.save(state);
  }
}
