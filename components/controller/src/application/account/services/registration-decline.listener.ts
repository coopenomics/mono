import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { CANDIDATE_REPOSITORY, CandidateRepository } from '~/domain/account/repository/candidate.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum, PaymentDirectionEnum, VAT_EXEMPT_NOTE } from '~/domain/gateway/enums/payment-type.enum';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import { RegistratorContract } from 'cooptypes';

// Имя on-chain события отказа в регистрации — из констант cooptypes, не хардкод.
const REGISTRATOR = RegistratorContract.contractName.production;
const DECLINE_REG_EVENT = `action::${REGISTRATOR}::${RegistratorContract.Actions.DeclineRegistration.actionName}`;

/**
 * Заводит исходящий платёж-возврат при отказе совета в приёме пайщика.
 *
 * Отказ приходит on-chain как registrator::declinereg — он срабатывает и при
 * истечении срока повестки, и при отрицательном консенсусе (>50% совета против,
 * PR #94), через общую decline-callback ветку.
 *
 * На момент отказа взнос по фондам НЕ разносился (confirmreg не было), но реальные
 * деньги пайщика уже у кооператива на расчётном счёте (стоят на расчётах с пайщиком,
 * счёт 76). Заводим исходящий платёж в реестр, чтобы кассир вернул вступительный +
 * мин.паевой. Подтверждение кассиром проводит on-chain возврат: gateway::outcomplete
 * → registrator::refundpay (обратная проводка Дт 76 / Кт 51), см.
 * gateway.interactor.processOutgoingPayment. Отклонить такой возврат нельзя.
 *
 * Хэш платежа-возврата = registration_hash: on-chain исходящий объект (создан
 * declinereg через gateway::createoutpay) идентифицируется этим же хэшем, и
 * completeOutcome({ outcome_hash }) при подтверждении кассой должен совпасть с ним.
 */
@Injectable()
export class RegistrationDeclineListener {
  private readonly logger = new Logger(RegistrationDeclineListener.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(CANDIDATE_REPOSITORY) private readonly candidateRepository: CandidateRepository,
  ) {}

  @OnEvent(DECLINE_REG_EVENT)
  async onDeclineRegistration(action: ActionDomainInterface): Promise<void> {
    const registration_hash = action?.data?.registration_hash as string | undefined;
    if (!registration_hash) return;

    const candidate = await this.candidateRepository.findByRegistrationHash(registration_hash);
    if (!candidate) {
      this.logger.warn(`declinereg: кандидат по registration_hash=${registration_hash} не найден — пропуск возврата`);
      return;
    }

    // Исходный вступительный платёж — источник суммы и номера (№ в QR = hash8).
    const original = await this.paymentRepository.findLatestByUsernameAndType(
      candidate.username,
      PaymentTypeEnum.REGISTRATION,
    );
    if (!original) {
      this.logger.warn(`declinereg: исходный регистрационный платёж для ${candidate.username} не найден — пропуск возврата`);
      return;
    }

    // Идемпотентность: повторный приход события (replay/форк) не плодит возвраты.
    // Но проверяем возврат именно ТЕКУЩЕГО цикла. На повторной подаче после прошлого
    // отказа в БД остаётся возврат прошлого цикла, и его hash совпадает с новым
    // (registration_hash = sha256(username) детерминирован). Возврат текущего цикла
    // создаётся ПОЗЖЕ текущего вступительного платежа — по этому и отличаем. Иначе
    // старый возврат блокировал бы создание нового, latest refund оставался бы старше
    // нового платежа, и фронт завис бы на «платёж принят». Детекция цикла по дате —
    // как в account.interactor (getAccount / resetRegistration / createRegistrationPayment).
    const existingRefund = await this.paymentRepository.findLatestByUsernameAndType(
      candidate.username,
      PaymentTypeEnum.REGISTRATION_REFUND,
    );
    if (
      existingRefund &&
      new Date(existingRefund.created_at).getTime() >= new Date(original.created_at).getTime()
    ) {
      this.logger.debug(
        `declinereg: возврат текущего цикла для ${candidate.username} уже существует (${existingRefund.id}) — пропуск`,
      );
      return;
    }

    const now = new Date();
    const refund: PaymentDomainInterface = {
      id: '',
      coopname: candidate.coopname || original.coopname,
      username: candidate.username,
      quantity: original.quantity,
      symbol: original.symbol,
      type: PaymentTypeEnum.REGISTRATION_REFUND,
      direction: PaymentDirectionEnum.OUTGOING,
      // Совет уже решил (отказ) — повторная авторизация не нужна, платёж сразу
      // готов к выплате кассиром (PENDING виден кассиру и имеет кнопку «Подтвердить»).
      status: PaymentStatusEnum.PENDING,
      // Назначение — зеркало входящего взноса: тот же № (первые 8 символов хэша
      // исходного платежа, что показывался пайщику в QR) и та же НДС-оговорка
      // (VAT_EXEMPT_NOTE). Назначение целиком хранится в memo — провайдеры её
      // больше не дописывают. Кассир копирует этот текст as-is в возвратный платёж.
      memo: `Возврат вступительного и минимального паевого взносов №${original.hash.slice(0, 8)}. ${VAT_EXEMPT_NOTE}`,
      provider: original.provider,
      secret: generateUniqueHash(),
      // Хэш = registration_hash: совпадает с outcome_hash on-chain исходящего
      // объекта (gateway::createoutpay в declinereg), чтобы completeOutcome при
      // подтверждении кассой нашёл его и вызвал registrator::refundpay.
      hash: registration_hash,
      expired_at: undefined, // бессрочный — как и прочие исходящие платежи
      created_at: now,
      updated_at: now,
    };

    const created = await this.paymentRepository.create(refund);
    this.logger.log(
      `declinereg: создан возврат ${created.id} для ${candidate.username} на ${original.quantity} ${original.symbol}`,
    );
  }
}
