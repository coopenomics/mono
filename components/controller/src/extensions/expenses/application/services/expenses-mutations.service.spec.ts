import { ExpensesMutationsService } from './expenses-mutations.service'
import type { ExpensesBlockchainPort } from '../../domain/interfaces/expenses-blockchain.port'
import type { GeneratorInfrastructureService } from '~/infrastructure/generator/generator.service'
import type { ExpenseProposalRepository } from '../../domain/repositories/expense-proposal.repository'
import type { PaymentRepository } from '~/domain/gateway/repositories/payment.repository'
import { PaymentDirectionEnum, PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum'
import config from '~/config/config'
import type { PayExpenseItemInputDTO } from '../dto/pay-expense-item.input'
import type { ReportExpenseItemInputDTO } from '../dto/report-expense-item.input'
import { ExpenseReportOutcome } from '../dto/report-expense-item.output'
import type { ReturnExpenseItemInputDTO } from '../dto/return-expense-item.input'
import type { OverspendExpenseItemInputDTO } from '../dto/overspend-expense-item.input'
import type { SubmitExpenseReportInputDTO } from '../dto/submit-expense-report.input'
import type { CreateExpenseProposalInputDTO } from '../dto/create-expense-proposal.input'
import { ExpenseMechanics } from '../../domain/enums/expense-mechanics.enum'
import { ExpenseRecipientType } from '../../domain/enums/expense-recipient-type.enum'
import { ExpenseReportState } from '../../domain/enums/expense-report-state.enum'

// Символ/precision берём из конфига ноды — тесты расчёта разницы не зависят от
// того, какой именно root_govern_symbol сконфигурирован в окружении CI.
const SYM = config.blockchain.root_govern_symbol
const PREC = config.blockchain.root_govern_precision
const asset = (n: number) => `${n.toFixed(PREC)} ${SYM}`

/**
 * Контракт-тест: backend-mutations пробрасывают payload в `ExpensesBlockchainPort`
 * с корректным action-mapping. createExpenseProposal раскладывает подписанный
 * document2 через `.toDocument()` и снимает реквизиты получателей-пайщиков.
 * authexp/declexp — callbacks решения совета, у backend'а их нет.
 */
describe('ExpensesMutationsService', () => {
  let service: ExpensesMutationsService
  let chain: jest.Mocked<ExpensesBlockchainPort>
  let generator: jest.Mocked<Pick<GeneratorInfrastructureService, 'generateDocument'>>
  let requisiteSnapshots: {
    validate: jest.Mock
    snapshot: jest.Mock
    formatForOwner: jest.Mock
    getItemRequisiteData: jest.Mock
    getCooperativeRequisiteData: jest.Mock
  }
  let proposals: { findByProposalHash: jest.Mock }
  let payments: { findByHash: jest.Mock; create: jest.Mock; update: jest.Mock }

  const fakeResult = { response: { transaction_id: 'tx_abc' } } as never

  beforeEach(() => {
    chain = {
      createExp: jest.fn().mockResolvedValue(fakeResult),
      payExp: jest.fn().mockResolvedValue(fakeResult),
      reportExp: jest.fn().mockResolvedValue(fakeResult),
      returnExp: jest.fn().mockResolvedValue(fakeResult),
      overspendExp: jest.fn().mockResolvedValue(fakeResult),
      closeExp: jest.fn().mockResolvedValue(fakeResult),
    } as unknown as jest.Mocked<ExpensesBlockchainPort>
    generator = {
      generateDocument: jest.fn().mockResolvedValue({} as never),
    }
    requisiteSnapshots = {
      validate: jest.fn().mockResolvedValue(undefined),
      snapshot: jest.fn().mockResolvedValue(undefined),
      formatForOwner: jest.fn().mockResolvedValue('Банковский перевод: счёт 40817810000000000000, Банк ВТБ (ПАО)'),
      getItemRequisiteData: jest.fn().mockResolvedValue({ data: { bank_name: 'ВТБ' }, requisites: 'счёт пайщика' }),
      getCooperativeRequisiteData: jest.fn().mockResolvedValue({ data: { bank_name: 'Банк кооператива' }, requisites: 'счёт кооператива' }),
    }
    proposals = { findByProposalHash: jest.fn().mockResolvedValue(null) }
    payments = {
      findByHash: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((p) => Promise.resolve({ ...p, id: 'pay-1' })),
      update: jest.fn().mockResolvedValue(undefined),
    }
    service = new ExpensesMutationsService(
      chain,
      generator as unknown as GeneratorInfrastructureService,
      requisiteSnapshots as never,
      proposals as unknown as ExpenseProposalRepository,
      payments as unknown as PaymentRepository
    )
  })

  // СЗ-зеркало с одной строкой-авансом на пайщика, выданный аванс = 1000.
  const mockProposalWithAdvance = (advance = 1000) =>
    proposals.findByProposalHash.mockResolvedValue({
      proposal_hash: '0xabc',
      items: [
        {
          // Зеркало хранит mechanics/recipient_type числами (ExpenseDomain enum):
          // ADVANCE=0, MEMBER=1. PAID=1.
          item_hash: '0xdef',
          mechanics: 0,
          recipient_type: 1,
          recipient: 'petrov',
          description: 'Закупка кормов',
          planned_amount: asset(advance),
          actual_amount: asset(advance),
          status: 1,
        },
      ],
    } as never)

  const makeSignedDoc = (overrides: Partial<{ hash: string; doc_hash: string; meta_hash: string }> = {}) => ({
    version: '1',
    hash: overrides.hash ?? '0xhash',
    doc_hash: overrides.doc_hash ?? '0xdoc',
    meta_hash: overrides.meta_hash ?? '0xmeta',
    meta: { title: 'Заявление', registry_id: 2010 },
    signatures: [
      {
        id: 0,
        signed_hash: '0xsignedhash',
        signer: 'ivanov',
        public_key: 'EOS6...',
        signature: 'SIG_K1_...',
        signed_at: '2026-06-02T10:00:00',
        meta: '',
      },
    ],
    toDocument(): any {
      return {
        version: '1',
        hash: overrides.hash ?? '0xhash',
        doc_hash: overrides.doc_hash ?? '0xdoc',
        meta_hash: overrides.meta_hash ?? '0xmeta',
        meta: JSON.stringify({ title: 'Заявление', registry_id: 2010 }),
        signatures: this.signatures,
      }
    },
  })

  it('createExpenseProposal → chain.createExp с раскладкой items + document2', async () => {
    const input: CreateExpenseProposalInputDTO = {
      coopname: 'voskhod',
      username: 'ivanov',
      proposal_hash: '0xabc',
      source_wallet: 'w.cap.blago',
      items: [
        {
          item_hash: '0xitem1',
          mechanics: ExpenseMechanics.ADVANCE,
          recipient_type: ExpenseRecipientType.MEMBER,
          recipient: 'petrov',
          description: 'Закупка кормов',
          planned_amount: '5000.0000 RUB',
          payment_method_id: 'pm-1',
        },
      ],
      statement: makeSignedDoc() as any,
    } as CreateExpenseProposalInputDTO

    await service.createExpenseProposal(input)

    expect(chain.createExp).toHaveBeenCalledTimes(1)
    const call = chain.createExp.mock.calls[0][0]
    expect(call.coopname).toBe('voskhod')
    expect(call.username).toBe('ivanov')
    expect(call.proposal_hash).toBe('0xabc')
    expect(call.source_wallet).toBe('w.cap.blago')
    expect(call.items).toHaveLength(1)
    expect(call.items[0].item_hash).toBe('0xitem1')
    expect(call.items[0].mechanics).toBe(0)
    expect(call.items[0].recipient_type).toBe(1)
    expect(call.callback).toEqual({ contract: '', action: '', data: '' })
    expect(call.statement.doc_hash).toBe('0xdoc')

    // Реквизиты: валидация до блокчейна, снимок — после.
    expect(requisiteSnapshots.validate).toHaveBeenCalledTimes(1)
    expect(requisiteSnapshots.snapshot).toHaveBeenCalledTimes(1)
    const snapItems = requisiteSnapshots.snapshot.mock.calls[0][1]
    expect(snapItems[0]).toMatchObject({
      proposalHash: '0xabc',
      itemHash: '0xitem1',
      recipient: 'petrov',
      isOrganization: false,
      paymentMethodId: 'pm-1',
    })
  })

  it('createExpenseProposal: ошибка валидации реквизитов не доходит до блокчейна', async () => {
    requisiteSnapshots.validate.mockRejectedValue(new Error('Не указаны реквизиты получателя'))
    const input: CreateExpenseProposalInputDTO = {
      coopname: 'voskhod',
      username: 'ivanov',
      proposal_hash: '0xabc',
      source_wallet: 'w.cap.blago',
      items: [
        {
          item_hash: '0xitem1',
          mechanics: ExpenseMechanics.ADVANCE,
          recipient_type: ExpenseRecipientType.SELF,
          recipient: 'ivanov',
          description: 'Канцелярия',
          planned_amount: '1000.0000 RUB',
        },
      ],
      statement: makeSignedDoc() as any,
    } as CreateExpenseProposalInputDTO

    await expect(service.createExpenseProposal(input)).rejects.toThrow('Не указаны реквизиты')
    expect(chain.createExp).not.toHaveBeenCalled()
  })

  it('payExpenseItem → chain.payExp({coopname, proposal_hash, item_hash, actual_amount})', async () => {
    const input = {
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      actual_amount: '100.0000 RUB',
    } as PayExpenseItemInputDTO

    await service.payExpenseItem(input)

    expect(chain.payExp).toHaveBeenCalledWith({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      actual_amount: '100.0000 RUB',
    })
  })

  it('reportExpenseItem → chain.reportExp({coopname, proposal_hash, item_hash})', async () => {
    const input = {
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
    } as ReportExpenseItemInputDTO

    const result = await service.reportExpenseItem(input)

    expect(chain.reportExp).toHaveBeenCalledWith({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
    })
    expect(result.outcome).toBe(ExpenseReportOutcome.CLOSED)
    expect(payments.create).not.toHaveBeenCalled()
  })

  it('reportExpenseItem: факт == аванс → CLOSED, платёжка расчёта не заводится', async () => {
    mockProposalWithAdvance(1000)
    // Платёж выдачи аванса (hash = item_hash) — для зеркалирования report_state.
    payments.findByHash.mockResolvedValue({ id: 'adv-1', hash: '0xdef', blockchain_data: { proposal_hash: '0xabc' } })
    const result = await service.reportExpenseItem({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      actual_amount: asset(1000),
    } as ReportExpenseItemInputDTO)

    expect(result.outcome).toBe(ExpenseReportOutcome.CLOSED)
    expect(chain.reportExp).toHaveBeenCalledTimes(1)
    expect(payments.create).not.toHaveBeenCalled()
    // Отчёт принят → зеркалим CLOSED в платёж аванса.
    expect(payments.update).toHaveBeenCalledWith('adv-1', {
      blockchain_data: { proposal_hash: '0xabc', report_state: ExpenseReportState.CLOSED },
    })
  })

  it('reportExpenseItem: недорасход → входящая платёжка EXPENSE_RETURN на разницу, reportexp отложен', async () => {
    mockProposalWithAdvance(1000)
    // Платёжка расчёта (хэш settlement) ещё не заведена → null (чтобы create сработал);
    // платёж выдачи аванса (item_hash '0xdef') существует → для зеркалирования report_state.
    payments.findByHash.mockImplementation((h: string) =>
      Promise.resolve(h === '0xdef' ? { id: 'adv-1', hash: '0xdef', blockchain_data: {} } : null),
    )
    const result = await service.reportExpenseItem({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      actual_amount: asset(800),
    } as ReportExpenseItemInputDTO)

    expect(result.outcome).toBe(ExpenseReportOutcome.RETURN_PENDING)
    expect(result.settlement_amount).toBe(asset(200))
    expect(chain.reportExp).not.toHaveBeenCalled()
    expect(payments.create).toHaveBeenCalledTimes(1)
    // Отчёт подан, ждём расчёт → зеркалим SETTLEMENT_PENDING + заявленный факт
    // (reported_amount) в платёж аванса; факт нужен реестру вместо выданного аванса.
    expect(payments.update).toHaveBeenCalledWith('adv-1', {
      blockchain_data: {
        report_state: ExpenseReportState.SETTLEMENT_PENDING,
        reported_amount: asset(800),
      },
    })
    const payment = payments.create.mock.calls[0][0]
    expect(payment.type).toBe(PaymentTypeEnum.EXPENSE_RETURN)
    expect(payment.direction).toBe(PaymentDirectionEnum.INCOMING)
    expect(payment.username).toBe('petrov')
    expect(payment.quantity).toBe(200)
    expect(payment.blockchain_data).toMatchObject({ proposal_hash: '0xabc', item_hash: '0xdef' })
    // Недорасход: реквизиты для оплаты — банк кооператива (пайщик возвращает ему).
    expect(requisiteSnapshots.getCooperativeRequisiteData).toHaveBeenCalledWith('voskhod')
    expect(payment.payment_details?.data).toMatchObject({ bank_name: 'Банк кооператива' })
  })

  it('reportExpenseItem: перерасход → исходящая платёжка EXPENSE_OVERSPEND на разницу, reportexp отложен', async () => {
    mockProposalWithAdvance(1000)
    const result = await service.reportExpenseItem({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      actual_amount: asset(1200),
    } as ReportExpenseItemInputDTO)

    expect(result.outcome).toBe(ExpenseReportOutcome.OVERSPEND_PENDING)
    expect(result.settlement_amount).toBe(asset(200))
    expect(chain.reportExp).not.toHaveBeenCalled()
    expect(payments.create).toHaveBeenCalledTimes(1)
    const payment = payments.create.mock.calls[0][0]
    expect(payment.type).toBe(PaymentTypeEnum.EXPENSE_OVERSPEND)
    expect(payment.direction).toBe(PaymentDirectionEnum.OUTGOING)
    expect(payment.quantity).toBe(200)
    // Перерасход: реквизиты для выплаты — снимок реквизитов пайщика по позиции.
    expect(requisiteSnapshots.getItemRequisiteData).toHaveBeenCalledWith('voskhod', '0xabc', '0xdef')
    expect(payment.payment_details?.data).toMatchObject({ bank_name: 'ВТБ' })
  })

  it('reportExpenseItem: повторный отчёт по той же позиции платёжку не дублирует (идемпотентность)', async () => {
    mockProposalWithAdvance(1000)
    payments.findByHash.mockResolvedValue({ hash: 'existing-hash' })
    const result = await service.reportExpenseItem({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      actual_amount: asset(800),
    } as ReportExpenseItemInputDTO)

    expect(result.outcome).toBe(ExpenseReportOutcome.RETURN_PENDING)
    expect(result.settlement_payment_hash).toBe('existing-hash')
    expect(payments.create).not.toHaveBeenCalled()
  })

  it('reportExpenseItem: повторный отчёт после поданного (SETTLEMENT_PENDING) запрещён', async () => {
    mockProposalWithAdvance(1000)
    // Платёж аванса уже несёт report_state SETTLEMENT_PENDING — отчёт подан ранее,
    // позиция on-chain ещё PAID (расчёт не подтверждён). Повторный отчёт обязан
    // отбиться на бэке, иначе плодятся дубль-платёжки расчёта.
    payments.findByHash.mockResolvedValue({
      id: 'adv-1',
      hash: '0xdef',
      blockchain_data: { proposal_hash: '0xabc', report_state: ExpenseReportState.SETTLEMENT_PENDING },
    })
    await expect(
      service.reportExpenseItem({
        coopname: 'voskhod',
        proposal_hash: '0xabc',
        item_hash: '0xdef',
        actual_amount: asset(800),
      } as ReportExpenseItemInputDTO),
    ).rejects.toThrow('Отчёт по этой позиции уже подан')
    expect(payments.create).not.toHaveBeenCalled()
  })

  it('returnExpenseItem → chain.returnExp({coopname, proposal_hash, item_hash, return_amount})', async () => {
    const input = {
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      return_amount: '50.0000 RUB',
    } as ReturnExpenseItemInputDTO

    await service.returnExpenseItem(input)

    expect(chain.returnExp).toHaveBeenCalledWith({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      return_amount: '50.0000 RUB',
    })
  })

  it('overspendExpenseItem → chain.overspendExp({coopname, proposal_hash, item_hash, overspend_amount})', async () => {
    const input = {
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      overspend_amount: '200.0000 RUB',
    } as OverspendExpenseItemInputDTO

    await service.overspendExpenseItem(input)

    expect(chain.overspendExp).toHaveBeenCalledWith({
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      overspend_amount: '200.0000 RUB',
    })
  })

  it('submitExpenseReport → chain.closeExp({coopname, proposal_hash})', async () => {
    const input = {
      coopname: 'voskhod',
      proposal_hash: '0xabc',
      total_actual_amount: '1500.0000 RUB',
      comment: 'пиар-кампания апрель',
    } as SubmitExpenseReportInputDTO

    await service.submitExpenseReport(input)

    expect(chain.closeExp).toHaveBeenCalledWith({ coopname: 'voskhod', proposal_hash: '0xabc' })
  })
})
