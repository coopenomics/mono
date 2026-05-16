import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import {
  MarketplaceOutgoingPaymentRequestStatuses,
  type MarketplaceOutgoingPaymentRequestStatus,
} from '../../domain/entities/marketplace-outgoing-payment-request.types';
import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import {
  GATEWAY_INTERACTOR_PORT,
  type GatewayInteractorPort,
} from '~/domain/wallet/ports/gateway-interactor.port';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';

export interface MarketplaceConfirmOutgoingPaymentInputDto {
  coopname: string;
  payment_request_id: string;
  /** Внешний reference банковского платежа (например, номер платёжного поручения). */
  payment_reference: string;
  /** Опционально — ссылка на выписку банка (URL / hash). */
  bank_statement_ref?: string | null;
}

export interface MarketplaceBlockOutgoingPaymentInputDto {
  coopname: string;
  payment_request_id: string;
  reason: string;
}

export interface MarketplaceOutgoingPaymentResult {
  payment_request: MarketplaceOutgoingPaymentRequestDomainEntity;
}

/**
 * Story 5.7: кассир подтверждает физический банковский перевод поставщику.
 * После подтверждения backend marketplace формирует Antelope-транзакцию
 * `o.mkt.payout` (TRANSFER, Дт 86 / Кт 51) — закрытие обязательства
 * перед поставщиком.
 *
 * MVP-ограничение: текущий C++ marketplace::signchair уже выполняет
 * o.mkt.payout композитно с o.mkt.purch (pre-L12). Поэтому в MVP
 * подтверждение кассира работает как audit-trail без on-chain
 * последствий — статус становится LEDGER_RECORDED сразу (payout уже
 * в ledger). Полная реализация L12 (lazy payout как отдельная
 * транзакция, контролируемая backend'ом) — техдолг PRD; требуется
 * разделение signchair и payout в C++ контракте.
 */
@Injectable()
export class MarketplaceOutgoingPaymentService {
  constructor(
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY)
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository,
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly coreGateway: GatewayInteractorPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceOutgoingPaymentService.name);
  }

  async confirm(
    input: MarketplaceConfirmOutgoingPaymentInputDto
  ): Promise<MarketplaceOutgoingPaymentResult> {
    if (!input.payment_reference || input.payment_reference.trim().length === 0) {
      throw new BadRequestException('Не указан payment_reference банковской операции.');
    }

    const payment = await this.loadPayment(input.coopname, input.payment_request_id);
    if (!payment.is_pending_cashier) {
      throw new ConflictException(
        `Запрос платежа в статусе «${payment.status}»; подтверждение кассира недопустимо.`
      );
    }

    // MVP: статус сразу LEDGER_RECORDED, так как payout уже атомарно в
    // ledger на signchair (pre-L12 поведение C++).
    const finalStatus: MarketplaceOutgoingPaymentRequestStatus =
      MarketplaceOutgoingPaymentRequestStatuses.LEDGER_RECORDED;

    const updated = await this.paymentRepo.confirmByCashier(payment.id, {
      confirmed_at: new Date(),
      payment_reference: input.payment_reference,
      bank_statement_ref: input.bank_statement_ref ?? null,
      payout_tx_hash: null,
      status: finalStatus,
    });

    // AR35 / 598-17: отзеркалить статус в core-реестре, если связка
    // установлена (core_payment_id заполняется в AplReceptionService).
    await this.mirrorCoreStatus(payment.core_payment_id, PaymentStatusEnum.COMPLETED);

    this.logger.log(
      `Outgoing payment ${payment.id} confirmed by cashier: reference="${input.payment_reference}", ` +
        `status=${finalStatus}. Поставщик ${payment.payee_account} получит уведомление о выплате.`
    );

    return { payment_request: updated };
  }

  private async mirrorCoreStatus(
    core_payment_id: string | null,
    coreStatus: PaymentStatusEnum
  ): Promise<void> {
    if (!core_payment_id) return;
    try {
      await this.coreGateway.setPaymentStatus({
        id: core_payment_id,
        status: coreStatus,
      });
    } catch (err: any) {
      this.logger.warn(
        `mirrorCoreStatus: не удалось обновить core payment ${core_payment_id} → ${coreStatus} (${err.message}); marketplace-статус актуальный, core рассинхронизирован.`
      );
    }
  }

  async markBlocked(
    input: MarketplaceBlockOutgoingPaymentInputDto
  ): Promise<MarketplaceOutgoingPaymentResult> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new BadRequestException('Не указана причина блокировки платежа.');
    }
    const payment = await this.loadPayment(input.coopname, input.payment_request_id);
    if (!payment.is_pending_cashier) {
      throw new ConflictException(
        `Запрос платежа в статусе «${payment.status}»; блокировка недопустима.`
      );
    }
    const updated = await this.paymentRepo.markBlocked(payment.id, input.reason);

    await this.mirrorCoreStatus(payment.core_payment_id, PaymentStatusEnum.CANCELLED);

    this.logger.warn(
      `Outgoing payment ${payment.id} помечен BLOCKED кассиром: ${input.reason}. Обязательство по 86 остаётся открытым, кооператив решает вручную.`
    );
    return { payment_request: updated };
  }

  private async loadPayment(
    coopname: string,
    id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity> {
    const payment = await this.paymentRepo.findById(id);
    if (!payment || payment.coopname !== coopname) {
      throw new NotFoundException('Запрос исходящего платежа не найден.');
    }
    return payment;
  }
}

export const MARKETPLACE_OUTGOING_PAYMENT_SERVICE = Symbol(
  'MARKETPLACE_OUTGOING_PAYMENT_SERVICE'
);
