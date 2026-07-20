import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum, PaymentDirectionEnum } from '~/domain/gateway/enums/payment-type.enum';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import { QuantityUtils } from '~/shared/utils/quantity.utils';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';
import { ExpenseRequisiteSnapshotTypeormEntity } from '../../infrastructure/entities/expense-requisite-snapshot.typeorm-entity';
import { EXPENSES_CHASSIS_CONFIG } from '../../domain/expenses-chassis.config';

/** Зеркало ExpenseDomain::RecipientType контракта expense. */
const RECIPIENT_ORG = 2;

/**
 * Заводит исходящие платежи в реестр платежей после авторизации СЗ советом.
 *
 * Подписан на `entitysynced::expense::proposals` (после save зеркала в PG).
 * При переходе СЗ в AUTHORIZED создаёт по одному OUTGOING-платежу на каждую
 * позицию расхода: реквизиты и назначение платежа берутся из снимка
 * `expense_requisite_snapshots` (зафиксирован при создании СЗ) и НЕ проходят
 * через блокчейн — это персональные данные. Кассир видит платёж в реестре
 * (PENDING), подтверждает оплату — gateway.interactor по типу EXPENSE проводит
 * on-chain `expense::payexp` (см. processOutgoingPayment).
 *
 * Идемпотентность: hash платежа = item_hash; повторный sync (replay/форк)
 * платежей-дублей не создаёт.
 */
@Injectable()
export class ExpensePaymentsListener {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
    @InjectRepository(ExpenseRequisiteSnapshotTypeormEntity)
    private readonly snapshots: Repository<ExpenseRequisiteSnapshotTypeormEntity>,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ExpensePaymentsListener.name);
  }

  @OnEvent('entitysynced::expense::proposals')
  async handleProposalSynced(payload: { entity: ExpenseProposalDomainEntity; blockNum: number }): Promise<void> {
    const { entity } = payload;

    if (entity.status !== ExpenseProposalStatus.AUTHORIZED) return;
    if (!entity.items?.length) return;

    for (const item of entity.items) {
      const itemHash = item.item_hash.toLowerCase();

      const existing = await this.payments.findByHash(itemHash);
      if (existing) continue;

      const snapshot = await this.snapshots.findOne({
        where: {
          coopname: entity.coopname,
          proposal_hash: entity.proposal_hash,
          item_hash: itemHash,
        },
      });
      if (!snapshot) {
        // СЗ авторизована, а реквизитов нет — кассир не сможет оплатить позицию.
        this.logger.error(
          `КРИТИЧНО: СЗ ${entity.proposal_hash} авторизована, но снимок реквизитов позиции ${itemHash} не найден — платёж не создан, нужна ручная сверка`
        );
        continue;
      }

      const { amount, symbol } = QuantityUtils.parseQuantityString(item.planned_amount);
      const isOrganization = item.recipient_type === RECIPIENT_ORG;
      const now = new Date();

      const payment: PaymentDomainInterface = {
        id: '',
        coopname: entity.coopname,
        // Владелец платежа в реестре = тот, к кому платёж относится ЛИЧНО:
        // аванс под отчёт — пайщик-получатель (платёж виден в его личном реестре,
        // его реквизиты/сертификат). Оплата организации — это платёж самого
        // КООПЕРАТИВА (получатель-организация в реквизитах), а НЕ инициатора СЗ:
        // инициатор лишь предложил расход, деньги идут не к нему — на его столе
        // пайщика такой платёж появляться не должен. Поэтому org-платёж
        // принадлежит кооперативу (coopname): в личных реестрах пайщиков он не
        // виден (там фильтр по username), кассир видит его в общем реестре
        // платежей кооператива (без фильтра по username). На on-chain payexp это
        // не влияет — проводка берёт coopname/proposal_hash/item_hash, не username.
        username: isOrganization ? entity.coopname : item.recipient,
        quantity: amount,
        symbol,
        type: PaymentTypeEnum.EXPENSE,
        direction: PaymentDirectionEnum.OUTGOING,
        // Совет уже решил — платёж сразу готов к выплате кассиром.
        status: PaymentStatusEnum.PENDING,
        // Назначение платежа из снимка: пайщику — всегда «Аванс под отчёт»,
        // организации — введённый при создании СЗ текст. Кассир копирует as-is.
        memo: snapshot.payment_purpose ?? EXPENSES_CHASSIS_CONFIG.advancePaymentPurpose,
        secret: generateUniqueHash(),
        payment_method_id: snapshot.method_id ?? undefined,
        payment_details: {
          // Для пайщика — снимок данных платёжного метода (банк/СБП — рендерится
          // в реестре как обычные реквизиты); для организации — свободные
          // реквизиты строкой + имя получателя.
          data: snapshot.data ?? {
            recipient_name: snapshot.recipient,
            requisites: snapshot.requisites,
          },
          amount_plus_fee: String(amount),
          amount_without_fee: String(amount),
          fee_amount: '0',
          fee_percent: 0,
          fact_fee_percent: 0,
          tolerance_percent: 0,
        },
        // Связь с СЗ для processOutgoingPayment (payexp требует proposal_hash)
        // и для кассира (что оплачиваем).
        blockchain_data: {
          proposal_hash: entity.proposal_hash,
          item_hash: itemHash,
          description: item.description,
        },
        expired_at: undefined, // бессрочный — как прочие исходящие платежи
        created_at: now,
        updated_at: now,
        hash: itemHash,
      };

      const created = await this.payments.create(payment);
      this.logger.log(
        `СЗ ${entity.proposal_hash}: создан исходящий платёж ${created.id} по позиции ${itemHash} на ${item.planned_amount} (${payment.memo})`
      );
    }
  }
}
