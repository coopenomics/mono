import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RegistratorContract } from 'cooptypes';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PAYMENT_METHOD_REPOSITORY, type PaymentMethodRepository } from '~/domain/common/repositories/payment-method.repository';
import { ACCOUNT_BLOCKCHAIN_PORT, type AccountBlockchainPort } from '~/domain/account/interfaces/account-blockchain.port';
import { SYSTEM_DOMAIN_PORT, type SystemDomainPort } from '~/domain/system/interfaces/system-domain.port';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum, PaymentDirectionEnum, VAT_EXEMPT_NOTE } from '~/domain/gateway/enums/payment-type.enum';
import type {
  PaymentDomainInterface,
  PaymentDetailsDomainInterface,
} from '~/domain/gateway/interfaces/payment-domain.interface';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { generateUniqueHash } from '~/utils/generate-hash.util';

// confirmexit — callback-экшен совета (одобрение повестки leavecoop). В cooptypes
// SDK-обёртки нет (не подаётся клиентом), поэтому имя экшена — как в контракте.
const REGISTRATOR = RegistratorContract.contractName.production;
const CONFIRM_EXIT_EVENT = `action::${REGISTRATOR}::confirmexit`;

/**
 * Заводит исходящий платёж-возврат паевого взноса при одобрении советом выхода
 * пайщика из кооператива.
 *
 * On-chain registrator::confirmexit (одобрение повестки leavecoop) сам считает
 * сумму возврата по L3-балансам (минимальный + целевой паевой), резервирует её
 * (o.wal.wthreq) и создаёт исходящий объект в gateway через createoutpay с
 * confirm-callback completexit. Но платёж в реестре gateway, который УВИДИТ
 * кассир, on-chain не создаётся — заводим его здесь по реквизитам пайщика.
 *
 * Подтверждение кассиром проводит on-chain завершение: default-ветка
 * gateway.interactor.processOutgoingPayment вызывает completeOutcome →
 * gateway::outcomplete → registrator::completexit (списание Дт80/Кт51 +
 * блокировка аккаунта). Поэтому hash платежа = exit_hash (= outcome_hash
 * on-chain объекта), иначе completeOutcome не найдёт объект.
 *
 * Реквизиты обязательны на момент подачи заявления (гейт в
 * MembershipExitService.createMembershipExit); здесь берём метод по умолчанию.
 */
@Injectable()
export class MembershipExitAuthorizationListener {
  private readonly logger = new Logger(MembershipExitAuthorizationListener.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(PAYMENT_METHOD_REPOSITORY) private readonly paymentMethodRepository: PaymentMethodRepository,
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    @Inject(SYSTEM_DOMAIN_PORT) private readonly systemDomainPort: SystemDomainPort
  ) {}

  @OnEvent(CONFIRM_EXIT_EVENT)
  async onConfirmExit(action: ActionDomainInterface): Promise<void> {
    const coopname = action?.data?.coopname as string | undefined;
    const exitHashFromAction = action?.data?.exit_hash as string | undefined;
    if (!coopname || !exitHashFromAction) return;

    // exit_hash на входе confirmexit есть, но username и итоговую сумму берём из
    // таблицы (контракт сам посчитал quantity и перевёл статус в authorized).
    const exit = await this.accountBlockchainPort.getExitByHash(coopname, exitHashFromAction);
    if (!exit) {
      // Запись могла быть стёрта контрактом — это штатно при total_return == 0
      // (возвращать нечего, выход финализирован без платежа).
      this.logger.debug(`confirmexit: запись выхода по exit_hash=${exitHashFromAction} не найдена — пропуск`);
      return;
    }

    const status = String(exit.status);
    if (status !== 'authorized') {
      this.logger.debug(`confirmexit: выход ${exit.exit_hash} в статусе "${status}" (не authorized) — пропуск`);
      return;
    }

    const exitHash = String(exit.exit_hash);
    const username = String(exit.username);

    // Идемпотентность: повторный приход события (replay/форк) не плодит платежи.
    const existing = await this.paymentRepository.findByHash(exitHash);
    if (existing) {
      this.logger.debug(`confirmexit: платёж возврата по выходу ${exitHash} уже создан (${existing.id}) — пропуск`);
      return;
    }

    // quantity на чейне — asset-строка вида "300.0000 RUB".
    const [amountStr, symbol] = String(exit.quantity).split(' ');
    const quantity = Number(amountStr);
    if (!symbol || !(quantity > 0)) {
      this.logger.warn(`confirmexit: нулевая/некорректная сумма возврата (${exit.quantity}) по выходу ${exitHash} — платёж не создаём`);
      return;
    }

    // Метод по умолчанию (или первый) — на момент подачи заявления реквизиты были
    // обязательны (гейт createMembershipExit). Если пайщик удалил их после подачи
    // — платёж создать не из чего, логируем ошибку (вырожденный случай).
    const methods = await this.paymentMethodRepository.list({
      username,
      page: 1,
      limit: 100,
      sortOrder: 'DESC',
    });
    const method = methods.items.find((m) => m.is_default) ?? methods.items[0];
    if (!method) {
      this.logger.error(
        `confirmexit: у пайщика ${username} нет реквизитов — невозможно создать возврат паевого по выходу ${exitHash}`
      );
      return;
    }

    const settings = await this.systemDomainPort.getSettings();
    const now = new Date();

    const paymentDetails: PaymentDetailsDomainInterface = {
      data: method.data,
      // Для исходящих платежей комиссия не применяется.
      amount_plus_fee: quantity.toString(),
      amount_without_fee: quantity.toString(),
      fee_amount: '0',
      fee_percent: 0,
      fact_fee_percent: 0,
      tolerance_percent: 0,
    };

    const payment: PaymentDomainInterface = {
      id: '',
      coopname,
      username,
      quantity,
      symbol,
      type: PaymentTypeEnum.MEMBERSHIP_EXIT,
      direction: PaymentDirectionEnum.OUTGOING,
      // Совет уже одобрил (confirmexit) — повторная авторизация не нужна, платёж
      // сразу готов к выплате кассиром (PENDING виден кассиру с кнопкой «Подтвердить»).
      status: PaymentStatusEnum.PENDING,
      provider: settings.provider_name,
      payment_method_id: method.method_id,
      payment_details: paymentDetails,
      memo: `Возврат паевого взноса при выходе из кооператива №${exitHash.slice(0, 8)}. ${VAT_EXEMPT_NOTE}`,
      secret: generateUniqueHash(),
      // hash = exit_hash = outcome_hash on-chain объекта (createoutpay в confirmexit),
      // чтобы completeOutcome при подтверждении кассой вызвал completexit.
      hash: exitHash,
      expired_at: undefined, // бессрочный — как и прочие исходящие платежи
      created_at: now,
      updated_at: now,
    };

    const created = await this.paymentRepository.create(payment);
    this.logger.log(
      `confirmexit: создан возврат паевого взноса ${created.id} для ${username} на ${quantity} ${symbol} (выход ${exitHash})`
    );
  }
}
