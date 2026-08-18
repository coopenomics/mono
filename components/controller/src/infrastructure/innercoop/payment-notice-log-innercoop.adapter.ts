import { Inject, Injectable } from '@nestjs/common';
import type { IPaymentNoticeLogPort, InnerPaymentNotice } from '@coopenomics/innercoop';
import { IPN_REPOSITORY, type IpnRepository } from '~/domain/gateway/repositories/ipn.repository';

/**
 * Реализация `IPaymentNoticeLogPort` поверх журнала уведомлений банка.
 *
 * Журнал хранится в базе ядра: он переживает перезапуск расширения, иначе
 * повторное уведомление после рестарта было бы засчитано как новое зачисление.
 */
@Injectable()
export class PaymentNoticeLogInnercoopAdapter implements IPaymentNoticeLogPort {
  constructor(
    @Inject(IPN_REPOSITORY)
    private readonly ipnRepository: IpnRepository
  ) {}

  async find(criteria: Partial<InnerPaymentNotice>): Promise<InnerPaymentNotice | null> {
    return this.ipnRepository.findOne(criteria);
  }

  async record(notice: Omit<InnerPaymentNotice, 'id' | 'created_at' | 'updated_at'>): Promise<InnerPaymentNotice> {
    return this.ipnRepository.create(notice);
  }
}
