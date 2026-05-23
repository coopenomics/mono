import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

/**
 * Переключает статус исходящего платежа в зависимости от on-chain решения совета.
 *
 * Платёж создаётся в PG со статусом AWAITING_AUTHORIZATION в момент подачи
 * заявки на возврат (wallet.interactor.ts::createWithdraw → gateway.createWithdraw).
 * До тех пор пока совет не утвердил выплату — кассир такой платёж не видит.
 *
 * - wallet::authwthd  → AWAITING_AUTHORIZATION → PENDING (кассир видит, может подтвердить).
 * - wallet::declinewthd → AWAITING_AUTHORIZATION → CANCELLED.
 */
@Injectable()
export class WithdrawAuthorizationListener {
  private readonly logger = new Logger(WithdrawAuthorizationListener.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
  ) {}

  @OnEvent('action::wallet::authwthd')
  async onAuthWithdraw(action: ActionDomainInterface): Promise<void> {
    const withdraw_hash = action?.data?.withdraw_hash as string | undefined;
    if (!withdraw_hash) return;

    const payment = await this.paymentRepository.findByHash(withdraw_hash);
    if (!payment || !payment.id) {
      this.logger.warn(`authwthd: платёж по hash=${withdraw_hash} не найден — пропуск`);
      return;
    }
    if (payment.status !== PaymentStatusEnum.AWAITING_AUTHORIZATION) {
      this.logger.debug(`authwthd: платёж ${payment.id} в статусе ${payment.status}, перевод не требуется`);
      return;
    }
    await this.paymentRepository.setPaymentStatus(payment.id, PaymentStatusEnum.PENDING);
    this.logger.log(`authwthd: платёж ${payment.id} → PENDING (совет авторизовал выплату)`);
  }

  @OnEvent('action::wallet::declinewthd')
  async onDeclineWithdraw(action: ActionDomainInterface): Promise<void> {
    const withdraw_hash = action?.data?.withdraw_hash as string | undefined;
    if (!withdraw_hash) return;

    const payment = await this.paymentRepository.findByHash(withdraw_hash);
    if (!payment || !payment.id) return;
    if (payment.status === PaymentStatusEnum.COMPLETED || payment.status === PaymentStatusEnum.CANCELLED) return;

    await this.paymentRepository.setPaymentStatus(payment.id, PaymentStatusEnum.CANCELLED);
    this.logger.log(`declinewthd: платёж ${payment.id} → CANCELLED (совет/gateway отклонил)`);
  }
}
