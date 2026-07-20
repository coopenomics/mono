import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { InterExpenseRequisiteItemInput } from '@coopenomics/inter'
import { PAYMENT_METHOD_REPOSITORY, PaymentMethodRepository } from '~/domain/common/repositories/payment-method.repository'
import { EXPENSES_CHASSIS_CONFIG } from '../../domain/expenses-chassis.config'
import { ExpenseRequisiteSnapshotTypeormEntity } from '../../infrastructure/entities/expense-requisite-snapshot.typeorm-entity'
import { formatPaymentMethodRequisites } from '../../domain/utils/format-requisites.util'

/**
 * Снимки реквизитов получателей по строкам СЗ. Канон gateway prepareWithdraw →
 * persistWithdraw: `validate` зовётся ДО on-chain заявки (метод существует),
 * `snapshot` — ПОСЛЕ (данные метода копируются на момент создания СЗ).
 * Реквизиты в чейн не пишутся — только в БД шасси и в документ 2010.
 */
@Injectable()
export class ExpenseRequisiteSnapshotsService {
  private readonly logger = new Logger(ExpenseRequisiteSnapshotsService.name)

  constructor(
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly paymentMethods: PaymentMethodRepository,
    @InjectRepository(ExpenseRequisiteSnapshotTypeormEntity)
    private readonly repository: Repository<ExpenseRequisiteSnapshotTypeormEntity>
  ) {}

  async validate(coopname: string, items: InterExpenseRequisiteItemInput[]): Promise<void> {
    await this.resolve(coopname, items)
  }

  async snapshot(coopname: string, items: InterExpenseRequisiteItemInput[]): Promise<void> {
    const snapshots = await this.resolve(coopname, items)
    if (snapshots.length === 0) return
    try {
      await this.repository.save(snapshots)
    } catch (error: any) {
      // On-chain заявка уже создана — без снимка бухгалтер не получит реквизиты
      // для оплаты. Требуется ручная сверка.
      this.logger.error(
        `КРИТИЧНО: СЗ ${items[0]?.proposalHash} создана on-chain, но снимок реквизитов не сохранён: ${error.message}`,
        error
      )
      throw error
    }
  }

  /** Снимки реквизитов всех строк СЗ — для сверки советом на странице расхода. */
  async listByProposal(coopname: string, proposalHash: string): Promise<ExpenseRequisiteSnapshotTypeormEntity[]> {
    return this.repository.find({
      where: { coopname, proposal_hash: proposalHash.toLowerCase() },
      order: { id: 'ASC' },
    })
  }

  /** Полные реквизиты платёжного метода пайщика строкой — для документов. */
  async formatForOwner(username: string, methodId: string): Promise<string> {
    const method = await this.paymentMethods.get({ username, method_id: methodId })
    return formatPaymentMethodRequisites(method)
  }

  /**
   * Снимок реквизитов пайщика по позиции СЗ — куда кассир платит при доплате
   * перерасхода (тот же платёжный метод, что и при выдаче аванса).
   */
  async getItemRequisiteData(
    coopname: string,
    proposalHash: string,
    itemHash: string
  ): Promise<{ data: Record<string, unknown> | null; requisites: string } | null> {
    const snapshot = await this.repository.findOne({
      where: { coopname, proposal_hash: proposalHash.toLowerCase(), item_hash: itemHash.toLowerCase() },
    })
    if (!snapshot) return null
    return { data: snapshot.data ?? null, requisites: snapshot.requisites ?? '' }
  }

  /**
   * Банковские реквизиты самого кооператива — куда пайщик возвращает
   * неиспользованный аванс (недорасход). Берём дефолтный (или первый) платёжный
   * метод аккаунта кооператива.
   */
  async getCooperativeRequisiteData(
    coopname: string
  ): Promise<{ data: Record<string, unknown> | null; requisites: string } | null> {
    const list = await this.paymentMethods.list({ username: coopname, page: 1, limit: 50, sortOrder: 'ASC' })
    const methods = list.items ?? []
    const method = methods.find((m) => m.is_default) ?? methods[0]
    if (!method) return null
    return {
      data: method.data as unknown as Record<string, unknown>,
      requisites: formatPaymentMethodRequisites(method),
    }
  }

  private async resolve(
    coopname: string,
    items: InterExpenseRequisiteItemInput[]
  ): Promise<ExpenseRequisiteSnapshotTypeormEntity[]> {
    return Promise.all(
      items.map(async (it) => {
        // Инвариант шасси: пайщику — только аванс под отчёт (средства на личные
        // реквизиты, расходом станут после отчёта чеком); организации — только
        // прямая оплата по выставленным реквизитам.
        if (it.isOrganization && it.mechanics !== 'DIRECT') {
          throw new BadRequestException(
            'Организации/ИП доступна только оплата по счёту (DIRECT) — аванс под отчёт ей не выдаётся'
          )
        }
        if (!it.isOrganization && it.mechanics !== 'ADVANCE') {
          throw new BadRequestException(
            `Пайщику ${it.recipient} средства передаются только авансом под отчёт (ADVANCE) — оплата по счёту доступна только организации/ИП`
          )
        }

        const snapshot = this.repository.create({
          coopname,
          proposal_hash: it.proposalHash.toLowerCase(),
          item_hash: it.itemHash.toLowerCase(),
          recipient: it.recipient,
          method_id: null,
          method_type: null,
          data: null,
          requisites: it.requisites ?? '',
          payment_purpose: it.paymentPurpose ?? null,
        })

        if (it.isOrganization) {
          return snapshot
        }

        // Пайщику назначение платежа фиксированное — кассир в платёжке всегда
        // указывает «Аванс под отчёт» (суть расхода — в описании позиции)
        snapshot.payment_purpose = EXPENSES_CHASSIS_CONFIG.advancePaymentPurpose

        if (!it.paymentMethodId) {
          throw new BadRequestException(
            `Не указаны реквизиты получателя ${it.recipient} (платёжный метод) по строке расхода`
          )
        }

        const method = await this.paymentMethods.get({
          username: it.recipient,
          method_id: it.paymentMethodId,
        })

        snapshot.method_id = method.method_id
        snapshot.method_type = method.method_type
        snapshot.data = method.data as unknown as Record<string, unknown>
        snapshot.requisites = formatPaymentMethodRequisites(method)
        return snapshot
      })
    )
  }
}
