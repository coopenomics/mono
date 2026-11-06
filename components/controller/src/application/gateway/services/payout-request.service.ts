import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import {
  PAYOUT_REQUEST_REPOSITORY,
  PayoutRequestStatusEnum,
  type PayoutRequestCreate,
  type PayoutRequestDomainInterface,
  type PayoutRequestRepository,
} from '~/domain/gateway/repositories/payout-request.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentDirectionEnum } from '~/domain/gateway/enums/payment-type.enum';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import { generateUniqueHash } from '~/utils/generate-hash.util';

/**
 * Заявки на выплату, которую решает совет: возврат паевого взноса,
 * материальная помощь и другие выплаты расширений по решению совета.
 *
 * Порядок процесса (решение владельца 04.11.2026): при подаче сохраняется
 * заявка с реквизитами, выбранными пайщиком, — платежа кассиру ещё нет;
 * решение совета создаёт платёж «ожидает» из заявки один в один; отказ совета
 * закрывает заявку, платежа не будет. Хэш заявки становится хэшем платежа —
 * по нему цепь и кассир находят выплату дальше.
 *
 * Повтор события решения безопасен: платёж по хэшу заводится один раз.
 */
@Injectable()
export class PayoutRequestService {
  private readonly logger = new Logger(PayoutRequestService.name);

  constructor(
    @Inject(PAYOUT_REQUEST_REPOSITORY) private readonly requests: PayoutRequestRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository
  ) {}

  /**
   * Сохранить заявку из собранного черновика платежа. Хэш занят платежом или
   * другой заявкой — отказ: одна заявка — одна выплата.
   */
  async register(draft: PaymentDomainInterface): Promise<PayoutRequestDomainInterface> {
    const hash = draft.hash.toLowerCase();
    if ((await this.payments.findByHash(hash)) || (await this.requests.findByHash(hash))) {
      throw DomainError.conflict('GATEWAY_PAYMENT_HASH_DUPLICATE', { hash });
    }
    const created = await this.requests.create(requestFromDraft(draft, hash));
    this.logger.log(
      `Заявка на выплату ${hash.slice(0, 8)} (${draft.type}) ${draft.quantity} ${draft.symbol} для ${draft.username} ждёт решения совета`
    );
    return created;
  }

  async find(hash: string): Promise<PayoutRequestDomainInterface | null> {
    return this.requests.findByHash(hash);
  }

  /**
   * Совет разрешил выплату: создать платёж кассиру из заявки. Платёж по хэшу
   * уже есть — новый не заводится (повтор события). Заявки нет — выплата
   * подана до заявок: платёж «ожидает решения совета» переводится кассиру, как
   * раньше.
   */
  async release(hash: string): Promise<PaymentDomainInterface | null> {
    const key = hash.toLowerCase();
    const existing = await this.payments.findByHash(key);
    if (existing) return this.releaseExisting(key, existing);

    const request = await this.requests.findByHash(key);
    if (!request) {
      this.logger.warn(`Выплата ${key.slice(0, 8)}: ни заявки, ни платежа — решение совета не к чему применить`);
      return null;
    }
    // Заявку забирает тот вызов, который первым отметил решение: повтор и
    // одновременный вызов платежа не создают.
    if (!(await this.requests.markDecided(key, PayoutRequestStatusEnum.RELEASED))) {
      this.logger.debug(`Выплата ${key.slice(0, 8)}: решение по заявке уже отмечено (${request.status}) — платёж не создаётся`);
      return this.payments.findByHash(key);
    }

    try {
      const payment = await this.payments.create(paymentFromRequest(request, new Date()));
      this.logger.log(`Выплата ${key.slice(0, 8)}: совет разрешил, платёж ${payment.id} создан для кассира`);
      return payment;
    } catch (e) {
      // Платёж не создан — заявка снова ждёт, повтор решения её подхватит.
      await this.requests.reopen(key);
      throw e;
    }
  }

  /** Платёж по хэшу уже есть: повтор события либо платёж, заведённый до заявок. */
  private async releaseExisting(key: string, existing: PaymentDomainInterface): Promise<PaymentDomainInterface> {
    if (existing.status === PaymentStatusEnum.AWAITING_AUTHORIZATION && existing.id) {
      await this.payments.setPaymentStatus(existing.id, PaymentStatusEnum.PENDING);
      this.logger.log(`Выплата ${key.slice(0, 8)}: платёж ${existing.id} передан кассиру решением совета`);
    }
    await this.requests.markDecided(key, PayoutRequestStatusEnum.RELEASED);
    return existing;
  }

  /**
   * Совет отказал: заявка закрывается, платежа не будет. Платёж, заведённый до
   * заявок в статусе «ожидает решения совета», отменяется, как раньше.
   */
  async decline(hash: string): Promise<void> {
    const key = hash.toLowerCase();
    const existing = await this.payments.findByHash(key);
    if (
      existing?.id &&
      existing.status !== PaymentStatusEnum.COMPLETED &&
      existing.status !== PaymentStatusEnum.CANCELLED
    ) {
      await this.payments.setPaymentStatus(existing.id, PaymentStatusEnum.CANCELLED);
      this.logger.log(`Выплата ${key.slice(0, 8)}: платёж ${existing.id} отменён решением совета`);
    }
    await this.requests.markDecided(key, PayoutRequestStatusEnum.DECLINED);
  }

  /** Подача в цепь не удалась — заявка до совета не дошла, снимаем её. */
  async drop(hash: string): Promise<void> {
    await this.requests.deleteAwaiting(hash);
  }
}

const orNull = <T>(value: T | null | undefined): T | null => value ?? null;
const orUndefined = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

/** Заявка из черновика платежа: сумма, реквизиты, назначение — без статуса и служебных полей платежа. */
function requestFromDraft(draft: PaymentDomainInterface, hash: string): PayoutRequestCreate {
  return {
    hash,
    coopname: draft.coopname,
    username: draft.username,
    quantity: draft.quantity,
    symbol: draft.symbol,
    type: draft.type,
    provider: orNull(draft.provider),
    payment_method_id: orNull(draft.payment_method_id),
    memo: orNull(draft.memo),
    expired_at: orNull(draft.expired_at),
    payment_details: orNull(draft.payment_details),
    blockchain_data: orNull(draft.blockchain_data),
    statement: orNull(draft.statement),
    related_extension: orNull(draft.related_extension),
    related_entity_id: orNull(draft.related_entity_id),
  };
}

/** Платёж кассиру «ожидает» из заявки — один в один, с новым секретом и датой решения. */
function paymentFromRequest(request: PayoutRequestDomainInterface, now: Date): PaymentDomainInterface {
  return {
    id: '',
    hash: request.hash,
    coopname: request.coopname,
    username: request.username,
    quantity: request.quantity,
    symbol: request.symbol,
    type: request.type,
    direction: PaymentDirectionEnum.OUTGOING,
    status: PaymentStatusEnum.PENDING,
    provider: orUndefined(request.provider),
    payment_method_id: orUndefined(request.payment_method_id),
    memo: orUndefined(request.memo),
    secret: generateUniqueHash(),
    expired_at: orUndefined(request.expired_at),
    payment_details: orUndefined(request.payment_details),
    blockchain_data: orUndefined(request.blockchain_data),
    statement: orUndefined(request.statement) as PaymentDomainInterface['statement'],
    created_at: now,
    updated_at: now,
  };
}
