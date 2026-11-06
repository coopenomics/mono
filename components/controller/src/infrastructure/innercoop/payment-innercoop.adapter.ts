import { Inject, Injectable } from '@nestjs/common';
import type {
  IPaymentPort,
  InnerPage,
  InnerPageRequest,
  InnerPayment,
  InnerPaymentDraft,
  InnerPaymentFilters,
  InnerPayoutRequest,
} from '@coopenomics/innercoop';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import {
  PAYOUT_REQUEST_REPOSITORY,
  type PayoutRequestRepository,
} from '~/domain/gateway/repositories/payout-request.repository';

/**
 * Реализация `IPaymentPort` для расширений.
 *
 * Открывает операции реестра платежей — завести, найти по хэшу, обновить —
 * и чтение заявки на выплату, которую решает совет. Остальное в реестре (фильтры кассирского стола, истечение,
 * реквизиты, провайдеры) остаётся ядру: расширение заводит платёж и следит за
 * его состоянием, но расчётный контур не ведёт.
 */
@Injectable()
export class PaymentInnercoopAdapter implements IPaymentPort {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    @Inject(PAYOUT_REQUEST_REPOSITORY)
    private readonly payoutRequests: PayoutRequestRepository
  ) {}

  async findPayoutRequestByHash(hash: string): Promise<InnerPayoutRequest | null> {
    const request = await this.payoutRequests.findByHash(hash);
    if (!request) return null;
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

  async findByHash(hash: string): Promise<InnerPayment | null> {
    return this.paymentRepository.findByHash(hash);
  }

  async create(payment: InnerPaymentDraft): Promise<InnerPayment> {
    return this.paymentRepository.create(payment);
  }

  async update(id: string, data: Partial<InnerPayment>): Promise<InnerPayment | null> {
    return this.paymentRepository.update(id, data);
  }

  async list(filters: InnerPaymentFilters, page: InnerPageRequest): Promise<InnerPage<InnerPayment>> {
    return this.paymentRepository.getAllPayments(filters, page);
  }
}
