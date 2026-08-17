import { Inject, Injectable } from '@nestjs/common';
import type {
  IPaymentMethodPort,
  InnerPage,
  InnerPageRequest,
  InnerPaymentMethod,
  InnerPaymentMethodDraft,
  InnerPaymentMethodQuery,
} from '@coopenomics/innercoop';
import {
  PAYMENT_METHOD_REPOSITORY,
  type PaymentMethodRepository,
} from '~/domain/common/repositories/payment-method.repository';
import { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';

/**
 * Реализация `IPaymentMethodPort` для расширений.
 *
 * Доменную сущность собирает здесь: расширение передаёт простые данные и не
 * конструирует классы ядра — за его пределами их нет.
 */
@Injectable()
export class PaymentMethodInnercoopAdapter implements IPaymentMethodPort {
  constructor(
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly paymentMethodRepository: PaymentMethodRepository
  ) {}

  async get(query: InnerPaymentMethodQuery): Promise<InnerPaymentMethod> {
    return this.paymentMethodRepository.get(query);
  }

  async list(username: string, page: InnerPageRequest): Promise<InnerPage<InnerPaymentMethod>> {
    return this.paymentMethodRepository.list({ username, ...page });
  }

  async save(method: InnerPaymentMethodDraft): Promise<InnerPaymentMethod> {
    return this.paymentMethodRepository.save(new PaymentMethodDomainEntity(method));
  }

  async remove(username: string, methodId: string): Promise<void> {
    return this.paymentMethodRepository.delete(username, methodId);
  }
}
