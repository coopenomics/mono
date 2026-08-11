import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WalletContract } from 'cooptypes';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

const WALLET = WalletContract.contractName.production;
const AUTH_WITHDRAW_EVENT = `action::${WALLET}::${WalletContract.Actions.AuthWithdraw.actionName}`;
const DECLINE_WITHDRAW_EVENT = `action::${WALLET}::${WalletContract.Actions.DeclineWithdraw.actionName}`;

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

  /**
   * Хэш заявки в callback-действиях совета приходит под разными именами:
   * `authwthd` объявлен через AUTHORIZE_CALLBACK_SIGNATURE и несёт поле `hash`,
   * `declinewthd` — собственное `withdraw_hash`. Блокчейн отдаёт checksum256
   * в верхнем регистре, в БД платёж хранится в нижнем — без нормализации
   * поиск по хэшу не находит платёж.
   */
  private extractWithdrawHash(action: ActionDomainInterface, actionLabel: string): string | undefined {
    const data = action?.data as { hash?: string; withdraw_hash?: string } | undefined;
    const raw = data?.hash ?? data?.withdraw_hash;
    if (!raw) {
      this.logger.warn(`${actionLabel}: в действии нет хэша заявки — пропуск`);
      return undefined;
    }
    return raw.toLowerCase();
  }

  @OnEvent(AUTH_WITHDRAW_EVENT)
  async onAuthWithdraw(action: ActionDomainInterface): Promise<void> {
    const withdraw_hash = this.extractWithdrawHash(action, 'authwthd');
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

  @OnEvent(DECLINE_WITHDRAW_EVENT)
  async onDeclineWithdraw(action: ActionDomainInterface): Promise<void> {
    const withdraw_hash = this.extractWithdrawHash(action, 'declinewthd');
    if (!withdraw_hash) return;

    const payment = await this.paymentRepository.findByHash(withdraw_hash);
    if (!payment || !payment.id) {
      this.logger.warn(`declinewthd: платёж по hash=${withdraw_hash} не найден — пропуск`);
      return;
    }
    if (payment.status === PaymentStatusEnum.COMPLETED || payment.status === PaymentStatusEnum.CANCELLED) return;

    await this.paymentRepository.setPaymentStatus(payment.id, PaymentStatusEnum.CANCELLED);
    this.logger.log(`declinewthd: платёж ${payment.id} → CANCELLED (совет/gateway отклонил)`);
  }
}
