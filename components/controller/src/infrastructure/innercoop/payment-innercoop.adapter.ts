import { Inject, Injectable } from '@nestjs/common';
import type { IPaymentPort, InnerPayment, InnerPaymentDraft } from '@coopenomics/innercoop';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';

/**
 * Реализация `IPaymentPort` для расширений.
 *
 * Открывает ровно три операции реестра платежей — завести, найти по хэшу,
 * обновить. Остальное в реестре (фильтры кассирского стола, истечение,
 * реквизиты, провайдеры) остаётся ядру: расширение заводит платёж и следит за
 * его состоянием, но расчётный контур не ведёт.
 */
@Injectable()
export class PaymentInnercoopAdapter implements IPaymentPort {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository
  ) {}

  async findByHash(hash: string): Promise<InnerPayment | null> {
    return this.paymentRepository.findByHash(hash);
  }

  async create(payment: InnerPaymentDraft): Promise<InnerPayment> {
    return this.paymentRepository.create(payment);
  }

  async update(id: string, data: Partial<InnerPayment>): Promise<InnerPayment | null> {
    return this.paymentRepository.update(id, data);
  }
}
