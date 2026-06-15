import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { TransactResult } from '@wharfkit/session'
import type { InterExpenseRequisiteItemInput } from '@coopenomics/inter'
import { Cooperative } from 'cooptypes'
import { GeneratorInfrastructureService } from '~/infrastructure/generator/generator.service'
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity'
import { ExpenseProposalStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/expense-proposal-statement-document.dto'
import { ExpenseProposalDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/expense-proposal-decision-document.dto'
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository'
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface'
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum'
import { PaymentDirectionEnum, PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum'
import { QuantityUtils } from '~/shared/utils/quantity.utils'
import { generateHashFromString, generateUniqueHash } from '~/utils/generate-hash.util'
import { CreateExpenseProposalInputDTO } from '../dto/create-expense-proposal.input'
import type { ExpenseItemInputDTO } from '../dto/expense-item.input'
import { PayExpenseItemInputDTO } from '../dto/pay-expense-item.input'
import { ReportExpenseItemInputDTO } from '../dto/report-expense-item.input'
import { ExpenseReportOutcome, ExpenseReportResultDTO } from '../dto/report-expense-item.output'
import { ReturnExpenseItemInputDTO } from '../dto/return-expense-item.input'
import { OverspendExpenseItemInputDTO } from '../dto/overspend-expense-item.input'
import { SubmitExpenseReportInputDTO } from '../dto/submit-expense-report.input'
import {
  EXPENSES_BLOCKCHAIN_PORT,
  ExpensesBlockchainPort,
} from '../../domain/interfaces/expenses-blockchain.port'
import {
  EXPENSE_PROPOSAL_REPOSITORY,
  ExpenseProposalRepository,
} from '../../domain/repositories/expense-proposal.repository'
import type { IExpenseItemBlockchainData } from '../../domain/interfaces/expense-proposal-blockchain.interface'
import { ExpenseMechanics } from '../../domain/enums/expense-mechanics.enum'
import { ExpenseRecipientType } from '../../domain/enums/expense-recipient-type.enum'
import { ExpenseReportState } from '../../domain/enums/expense-report-state.enum'
import { EXPENSES_CHASSIS_CONFIG } from '../../domain/expenses-chassis.config'
import { ExpenseRequisiteSnapshotsService } from './expense-requisite-snapshots.service'

/** Зеркало ExpenseDomain::Mechanics::ADVANCE контракта expense. */
const MECHANICS_ADVANCE = 0

/**
 * Write-сервис расходов.
 *
 * Подписывает ключом кооператива (`active`), `account = expense`. Для пайщик-actions
 * (`reportexp` / `returnexp`) — тот же канон, что в capital (`createCommit` пайщика
 * сервисно подписан кооперативом). Авторизация / отклонение СЗ идут через решение
 * совета (callbacks authexp/declexp от контракта soviet) — здесь их нет.
 */
@Injectable()
export class ExpensesMutationsService {
  constructor(
    @Inject(EXPENSES_BLOCKCHAIN_PORT)
    private readonly chain: ExpensesBlockchainPort,
    private readonly generator: GeneratorInfrastructureService,
    private readonly requisiteSnapshots: ExpenseRequisiteSnapshotsService,
    @Inject(EXPENSE_PROPOSAL_REPOSITORY)
    private readonly proposals: ExpenseProposalRepository,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository
  ) {}

  async generateExpenseProposalStatementDocument(
    data: ExpenseProposalStatementGenerateDocumentInputDTO,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    const registry_id = Cooperative.Registry.ExpenseProposalStatement.registry_id

    // Фонд списания — параметр шасси, фронт его не передаёт
    const proposal = { ...data.proposal, fund_name: EXPENSES_CHASSIS_CONFIG.fundNameDative }

    // Приватная часть позиций — имя/реквизиты/назначение платежа. Полные реквизиты
    // получателей подставляет сервер по payment_method_id (фронт знает только
    // сокращённое представление). Эти данные НЕ публикуются в блокчейн: они
    // сохраняются off-chain в doc_data фабрики, а в meta документа едет только
    // doc_data_hash. Корреляция с публичной позицией — по number.
    const privateItems = await Promise.all(
      data.items.map(async (item) => {
        let requisites = item.requisites
        if (item.payment_method_id) {
          const owner = item.recipient_username || data.username
          requisites = await this.requisiteSnapshots.formatForOwner(owner, item.payment_method_id)
        }
        return {
          number: item.number,
          recipient_name: item.recipient_name,
          requisites,
          // Пайщику назначение платежа не вводится — всегда «Аванс под отчёт»
          payment_purpose:
            item.recipient_type === 'ORG' ? item.payment_purpose : EXPENSES_CHASSIS_CONFIG.advancePaymentPurpose,
        }
      })
    )

    const privatePayload: Cooperative.Registry.ExpenseProposalStatement.PrivateData = { items: privateItems }
    const { hash: doc_data_hash } = await this.generator.saveDocData(
      privatePayload as unknown as Record<string, unknown>,
      registry_id
    )

    // Публичные позиции — без реквизитов/имени/назначения (только структура и суммы).
    const items: Cooperative.Registry.ExpenseProposalStatement.IExpenseItem[] = data.items.map((item) => ({
      number: item.number,
      description: item.description,
      amount: item.amount,
      recipient_type: item.recipient_type,
      mechanics: item.mechanics,
    }))

    const action = {
      ...data,
      registry_id,
      proposal,
      items,
      doc_data_hash,
    } as unknown as Cooperative.Registry.ExpenseProposalStatement.Action

    return this.generator.generateDocument({ data: action, options: options || {} })
  }

  async generateExpenseProposalDecisionDocument(
    data: ExpenseProposalDecisionGenerateDocumentInputDTO,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ExpenseProposalDecision.registry_id
    return this.generator.generateDocument({ data: data as unknown as Cooperative.Registry.ExpenseProposalDecision.Action, options: options || {} })
  }

  async createExpenseProposal(input: CreateExpenseProposalInputDTO): Promise<TransactResult> {
    // Валидация реквизитов ДО блокчейна, снимок — ПОСЛЕ (канон gateway
    // prepareWithdraw → persistWithdraw). Реквизиты в чейн не пишутся.
    const requisiteItems = toRequisiteItems(input.proposal_hash, input.items)
    await this.requisiteSnapshots.validate(input.coopname, requisiteItems)

    const items = input.items.map((it) => ({
      item_hash: it.item_hash,
      mechanics: it.mechanics === ExpenseMechanics.DIRECT ? 1 : 0,
      recipient_type:
        it.recipient_type === ExpenseRecipientType.SELF
          ? 0
          : it.recipient_type === ExpenseRecipientType.MEMBER
            ? 1
            : 2,
      recipient: it.recipient,
      description: it.description,
      planned_amount: it.planned_amount,
      actual_amount: it.planned_amount,
      status: 0,
    }))

    const statement = input.statement.toDocument()

    const result = await this.chain.createExp({
      coopname: input.coopname,
      username: input.username,
      proposal_hash: input.proposal_hash,
      source_wallet: input.source_wallet,
      items,
      callback: {
        contract: input.callback?.contract ?? '',
        action: input.callback?.action ?? '',
        data: input.callback?.data ?? '',
      },
      statement: {
        version: statement.version,
        hash: statement.hash,
        doc_hash: statement.doc_hash,
        meta_hash: statement.meta_hash,
        meta: statement.meta,
        signatures: statement.signatures,
      } as any,
    })

    await this.requisiteSnapshots.snapshot(input.coopname, requisiteItems)

    return result
  }

  async payExpenseItem(input: PayExpenseItemInputDTO): Promise<TransactResult> {
    return this.chain.payExp({
      coopname: input.coopname,
      proposal_hash: input.proposal_hash,
      item_hash: input.item_hash,
      actual_amount: input.actual_amount,
    })
  }

  /**
   * Отчёт пайщика по строке-авансу. Если факт совпал с выданным авансом (или не
   * указан) — закрываем позицию on-chain (`reportexp`). Если факт расходится —
   * заводим платёжку расчёта разницы (возврат/доплата) и откладываем `reportexp`
   * до её подтверждения кассиром (контракт принимает returnexp/overspendexp
   * только пока позиция в статусе PAID, поэтому расчёт обязан пройти ДО закрытия).
   */
  async reportExpenseItem(input: ReportExpenseItemInputDTO): Promise<ExpenseReportResultDTO> {
    // Защита от повторного отчёта. Позиция on-chain остаётся PAID до подтверждения
    // расчётной платёжки кассой (reportexp отложен), поэтому без этого guard'а
    // пайщик/кассир могли отчитываться многократно на разные суммы, плодя дубль-
    // платёжки расчёта (идемпотентность createSettlementPayment — лишь по виду
    // возврат/доплата, не по факту «отчёт уже подан»). Источник истины —
    // report_state в зеркале платежа выдачи аванса.
    const reportState = await this.getAdvanceReportState(input.item_hash)
    if (reportState === ExpenseReportState.SETTLEMENT_PENDING || reportState === ExpenseReportState.CLOSED) {
      throw new BadRequestException('Отчёт по этой позиции уже подан — повторный отчёт недоступен')
    }

    if (!input.actual_amount) {
      const transaction = await this.chain.reportExp({
        coopname: input.coopname,
        proposal_hash: input.proposal_hash,
        item_hash: input.item_hash,
      })
      await this.markAdvanceReportState(input.item_hash, ExpenseReportState.CLOSED)
      return { outcome: ExpenseReportOutcome.CLOSED, transaction: transaction as any }
    }

    const proposal = await this.proposals.findByProposalHash(input.proposal_hash)
    const item = proposal?.items?.find(
      (i) => i.item_hash?.toLowerCase() === input.item_hash.toLowerCase()
    )
    if (!proposal || !item) {
      throw new NotFoundException('Строка расхода не найдена')
    }
    if (item.mechanics !== MECHANICS_ADVANCE) {
      throw new BadRequestException('Отчёт о фактической сумме применим только к авансу под отчёт')
    }

    // База расчёта — фактически ВЫДАННЫЙ аванс (item.actual_amount после payexp),
    // а не план: устойчиво к частичной выдаче аванса кассиром.
    const advance = parseAssetToMinor(item.actual_amount)
    const factual = parseAssetToMinor(input.actual_amount)
    if (advance.symbol !== factual.symbol) {
      throw new BadRequestException('Символ фактической суммы не совпадает с символом аванса')
    }

    const deltaMinor = factual.minor - advance.minor
    if (deltaMinor === 0) {
      const transaction = await this.chain.reportExp({
        coopname: input.coopname,
        proposal_hash: input.proposal_hash,
        item_hash: input.item_hash,
      })
      await this.markAdvanceReportState(input.item_hash, ExpenseReportState.CLOSED)
      return { outcome: ExpenseReportOutcome.CLOSED, transaction: transaction as any }
    }

    const isUnderspend = deltaMinor < 0
    const diffAmount = Math.abs(deltaMinor) / 10 ** advance.precision
    const diffAsset = QuantityUtils.formatQuantityForBlockchain(diffAmount, advance.symbol)
    const paymentHash = await this.createSettlementPayment(
      input.coopname,
      input.proposal_hash,
      item,
      isUnderspend,
      diffAmount,
      advance.symbol
    )

    // Отчёт подан, но позиция закроется (reportexp) только после подтверждения
    // платёжки расчёта кассой — фиксируем промежуточное состояние для реестра.
    // reported_amount храним рядом, чтобы реестр показывал заявленный факт
    // (а не выданный аванс) и не предлагал отчитаться повторно.
    await this.markAdvanceReportState(input.item_hash, ExpenseReportState.SETTLEMENT_PENDING, {
      reported_amount: input.actual_amount,
    })

    return {
      outcome: isUnderspend ? ExpenseReportOutcome.RETURN_PENDING : ExpenseReportOutcome.OVERSPEND_PENDING,
      settlement_amount: diffAsset,
      settlement_payment_hash: paymentHash,
    }
  }

  /**
   * Зеркалит состояние отчёта в платёж выдачи аванса (hash платежа = item_hash) —
   * реестр платежей показывает «Требуется отчёт / подан / принят» рядом со
   * статусом платежа, не дёргая цепь. Статус платежа при этом не трогаем.
   */
  private async markAdvanceReportState(
    itemHash: string,
    state: ExpenseReportState,
    extra?: Record<string, unknown>
  ): Promise<void> {
    const payment = await this.payments.findByHash(itemHash.toLowerCase())
    if (!payment?.id) return
    await this.payments.update(payment.id, {
      blockchain_data: { ...(payment.blockchain_data ?? {}), report_state: state, ...(extra ?? {}) },
    })
  }

  /**
   * Текущее состояние отчёта по строке-авансу — из зеркала в платеже выдачи
   * (`blockchain_data.report_state`). AWAITING по умолчанию: отчёт ещё не подан.
   * Нужен guard'у reportExpenseItem против повторной подачи.
   */
  private async getAdvanceReportState(itemHash: string): Promise<ExpenseReportState> {
    const payment = await this.payments.findByHash(itemHash.toLowerCase())
    const state = (payment?.blockchain_data as { report_state?: ExpenseReportState } | undefined)?.report_state
    return state ?? ExpenseReportState.AWAITING
  }

  /**
   * Заводит manual-confirm платёжку расчёта разницы в общем реестре платежей
   * (как платёж выдачи аванса) — кассир подтверждает по факту движения денег, и
   * gateway проводит on-chain returnexp/overspendexp + reportexp. Идемпотентно по
   * детерминированному хэшу: повторный отчёт по той же позиции платёжку не плодит.
   */
  private async createSettlementPayment(
    coopname: string,
    proposalHash: string,
    item: IExpenseItemBlockchainData,
    isUnderspend: boolean,
    amount: number,
    symbol: string
  ): Promise<string> {
    const itemHash = item.item_hash.toLowerCase()
    const kind = isUnderspend ? 'return' : 'overspend'
    const hash = generateHashFromString(`expense-settlement:${coopname}:${itemHash}:${kind}`)

    const existing = await this.payments.findByHash(hash)
    if (existing) return existing.hash

    // Реквизиты для платёжки: при недорасходе пайщик платит КООПЕРАТИВУ (его банк),
    // при перерасходе кооператив платит ПАЙЩИКУ (снимок реквизитов позиции — тот
    // же метод, что при выдаче аванса). Кассир/пайщик видят их в деталях платежа.
    const requisite = isUnderspend
      ? await this.requisiteSnapshots.getCooperativeRequisiteData(coopname)
      : await this.requisiteSnapshots.getItemRequisiteData(coopname, proposalHash, itemHash)

    const now = new Date()
    const amountStr = amount.toFixed(2)
    const payment: PaymentDomainInterface = {
      id: '',
      coopname,
      // Позиция-аванс всегда оформлена на пайщика-получателя — расчёт разницы
      // относится лично к нему (виден в его личном реестре платежей).
      username: item.recipient,
      quantity: amount,
      symbol,
      type: isUnderspend ? PaymentTypeEnum.EXPENSE_RETURN : PaymentTypeEnum.EXPENSE_OVERSPEND,
      direction: isUnderspend ? PaymentDirectionEnum.INCOMING : PaymentDirectionEnum.OUTGOING,
      status: PaymentStatusEnum.PENDING,
      // Назначение фиксированное (суть расхода — в описании позиции, поле
      // blockchain_data.description показывается отдельно как «Что оплачиваем»).
      memo: isUnderspend
        ? 'Возврат неиспользованных средств, выданных авансом под отчёт'
        : 'Доплата по перерасходу аванса под отчёт',
      secret: generateUniqueHash(),
      payment_method_id: undefined,
      payment_details: {
        // Полные реквизиты (банк/СБП) — те же поля, что у платежа выдачи аванса;
        // деталь платежа рендерит их строками с копированием.
        data: requisite?.data ?? { requisites: requisite?.requisites ?? '' },
        amount_plus_fee: amountStr,
        amount_without_fee: amountStr,
        fee_amount: '0',
        fee_percent: 0,
        fact_fee_percent: 0,
        tolerance_percent: 0,
      },
      // proposal_hash + item_hash нужны gateway для returnexp/overspendexp; hash
      // платёжки уникальный (не item_hash) — не пересекается с платежом выдачи.
      blockchain_data: {
        proposal_hash: proposalHash.toLowerCase(),
        item_hash: itemHash,
        description: item.description,
      },
      expired_at: undefined,
      created_at: now,
      updated_at: now,
      hash,
    }

    const created = await this.payments.create(payment)
    return created.hash
  }

  async returnExpenseItem(input: ReturnExpenseItemInputDTO): Promise<TransactResult> {
    return this.chain.returnExp({
      coopname: input.coopname,
      proposal_hash: input.proposal_hash,
      item_hash: input.item_hash,
      return_amount: input.return_amount,
    })
  }

  async overspendExpenseItem(input: OverspendExpenseItemInputDTO): Promise<TransactResult> {
    return this.chain.overspendExp({
      coopname: input.coopname,
      proposal_hash: input.proposal_hash,
      item_hash: input.item_hash,
      overspend_amount: input.overspend_amount,
    })
  }

  async submitExpenseReport(input: SubmitExpenseReportInputDTO): Promise<TransactResult> {
    return this.chain.closeExp({
      coopname: input.coopname,
      proposal_hash: input.proposal_hash,
    })
  }
}

/**
 * Парсит asset-строку ("800.0000 RUB") в целые минорные единицы по precision
 * символа — сравнение/вычитание сумм без ошибок плавающей точки.
 */
function parseAssetToMinor(asset: string): { minor: number; symbol: string; precision: number } {
  const { amount, symbol } = QuantityUtils.parseQuantityString(asset)
  const precision = QuantityUtils.getPrecisionForSymbol(symbol)
  return { minor: Math.round(amount * 10 ** precision), symbol, precision }
}

function toRequisiteItems(proposalHash: string, items: ExpenseItemInputDTO[]): InterExpenseRequisiteItemInput[] {
  return items.map((it) => ({
    proposalHash,
    itemHash: it.item_hash,
    recipient: it.recipient,
    isOrganization: it.recipient_type === ExpenseRecipientType.ORG,
    mechanics: it.mechanics === ExpenseMechanics.DIRECT ? 'DIRECT' : 'ADVANCE',
    paymentMethodId: it.payment_method_id,
    requisites: it.requisites,
    paymentPurpose: it.payment_purpose,
  }))
}
