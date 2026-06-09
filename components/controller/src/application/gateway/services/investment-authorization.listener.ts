import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { HubClientService } from '~/infrastructure/hub/hub-client.service';

/**
 * Переключает статус исходящего платежа по инвестированию средств кооператива
 * в ЦПП оператора в зависимости от on-chain решения совета.
 *
 * Платёж создаётся в PG со статусом AWAITING_AUTHORIZATION в момент подачи
 * заявки (wallet.interactor.ts::createCooperativeInvestment). Пока совет не
 * принял решение — кассир платёж не видит.
 *
 * - wallet::authinv → AWAITING_AUTHORIZATION → PENDING; дополнительно бэкенд
 *   обращается к бэкенду оператора, создаёт там счёт на пополнение главного
 *   кошелька организации (createDepositPayment) и кладёт его реквизиты и
 *   назначение платежа в payment_details/memo — кассир платит уже по точному
 *   счёту оператора. Счёт создаётся именно сейчас, а не в момент предложения:
 *   счета оператора живут 24 часа, а совет может рассматривать вопрос дольше.
 * - wallet::declineinv → AWAITING_AUTHORIZATION → CANCELLED.
 */
@Injectable()
export class InvestmentAuthorizationListener {
  private readonly logger = new Logger(InvestmentAuthorizationListener.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    private readonly hubClientService: HubClientService
  ) {}

  @OnEvent('action::wallet::authinv')
  async onAuthInvestment(action: ActionDomainInterface): Promise<void> {
    // Сигнатура authinv — AUTHORIZE_CALLBACK_SIGNATURE: поле называется `hash`
    const invest_hash = (action?.data?.hash ?? action?.data?.invest_hash) as string | undefined;
    if (!invest_hash) return;

    const payment = await this.paymentRepository.findByHash(invest_hash);
    if (!payment || !payment.id) {
      this.logger.warn(`authinv: платёж по hash=${invest_hash} не найден — пропуск`);
      return;
    }
    if (payment.status !== PaymentStatusEnum.AWAITING_AUTHORIZATION) {
      this.logger.debug(`authinv: платёж ${payment.id} в статусе ${payment.status}, перевод не требуется`);
      return;
    }

    await this.paymentRepository.setPaymentStatus(payment.id, PaymentStatusEnum.PENDING);
    this.logger.log(`authinv: платёж ${payment.id} → PENDING (совет одобрил инвестирование)`);

    // Обогащение платежа точным счётом оператора. Недоступность оператора не
    // блокирует процесс: кассир увидит реквизиты из заявления, а назначение
    // платежа можно будет уточнить повторным открытием платежа.
    try {
      const invoice = await this.hubClientService.createDepositInvoice(payment.quantity, payment.symbol);
      await this.paymentRepository.update(payment.id, {
        memo: invoice.memo,
        payment_details: {
          ...(payment.payment_details ?? {
            amount_plus_fee: payment.quantity.toString(),
            amount_without_fee: payment.quantity.toString(),
            fee_amount: '0',
            fee_percent: 0,
            fact_fee_percent: 0,
            tolerance_percent: 0,
          }),
          data: invoice.details_text,
        },
      });
      this.logger.log(`authinv: платёж ${payment.id} обогащён счётом оператора №${invoice.hash.slice(0, 8)}`);
    } catch (error: any) {
      this.logger.warn(
        `authinv: не удалось получить счёт оператора для платежа ${payment.id}: ${error.message} — кассир увидит реквизиты из заявления`
      );
    }
  }

  @OnEvent('action::wallet::declineinv')
  async onDeclineInvestment(action: ActionDomainInterface): Promise<void> {
    const invest_hash = (action?.data?.invest_hash ?? action?.data?.hash) as string | undefined;
    if (!invest_hash) return;

    const payment = await this.paymentRepository.findByHash(invest_hash);
    if (!payment || !payment.id) return;
    if (payment.status === PaymentStatusEnum.COMPLETED || payment.status === PaymentStatusEnum.CANCELLED) return;

    await this.paymentRepository.setPaymentStatus(payment.id, PaymentStatusEnum.CANCELLED);
    this.logger.log(`declineinv: платёж ${payment.id} → CANCELLED (совет/gateway отклонил)`);
  }
}
