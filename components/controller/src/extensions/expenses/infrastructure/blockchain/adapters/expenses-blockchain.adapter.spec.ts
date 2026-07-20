import { ExpenseContract } from 'cooptypes'
import { ExpensesBlockchainAdapter } from './expenses-blockchain.adapter'
import type { BlockchainService } from '~/infrastructure/blockchain/blockchain.service'
import type { VaultDomainService } from '~/domain/vault/services/vault-domain.service'

/**
 * Контракт-тест адаптера: каждое действие подписывается ключом кооператива
 * на `account = expense`, `permission = active`, `actor = coopname`.
 *
 * Гарантия — не вырастет дрейф между cooptypes/expense actionName'ами и тем,
 * что реально уходит в `BlockchainService.transact`.
 */
describe('ExpensesBlockchainAdapter', () => {
  let blockchain: jest.Mocked<Pick<BlockchainService, 'initialize' | 'transact'>>
  let vault: jest.Mocked<Pick<VaultDomainService, 'getWif'>>
  let adapter: ExpensesBlockchainAdapter

  const fakeResult = { response: { transaction_id: 'tx_zzz' } } as never

  beforeEach(() => {
    blockchain = {
      initialize: jest.fn(),
      transact: jest.fn().mockResolvedValue(fakeResult),
    }
    vault = {
      getWif: jest.fn().mockResolvedValue('5KQwrPbwdL6Ph...'),
    }
    adapter = new ExpensesBlockchainAdapter(
      blockchain as unknown as BlockchainService,
      vault as unknown as VaultDomainService
    )
  })

  const coopname = 'voskhod'

  function assertTransactShape(name: string): void {
    expect(vault.getWif).toHaveBeenCalledWith(coopname)
    expect(blockchain.initialize).toHaveBeenCalledWith(coopname, '5KQwrPbwdL6Ph...')
    expect(blockchain.transact).toHaveBeenCalledWith(
      expect.objectContaining({
        account: ExpenseContract.contractName.production,
        name,
        authorization: [{ actor: coopname, permission: 'active' }],
      })
    )
  }

  const fakeDoc2 = {
    version: '1',
    hash: '0xh',
    doc_hash: '0xd',
    meta_hash: '0xm',
    meta: '{}',
    signatures: [],
  } as any

  it('createExp → transact(expense, createexp, [{coopname, active}])', async () => {
    await adapter.createExp({
      coopname,
      username: 'ivanov',
      proposal_hash: '0xabc',
      source_wallet: 'w.cap.blago',
      items: [],
      callback: { contract: '', action: '', data: '' },
      statement: fakeDoc2,
    })
    assertTransactShape(ExpenseContract.Actions.CreateExp.actionName)
  })

  // authexp/declexp исполняет контракт soviet как callbacks решения совета —
  // в backend-адаптере их нет по дизайну (см. expenses-blockchain.port.ts).

  it('payExp → transact(expense, payexp, [{coopname, active}])', async () => {
    await adapter.payExp({
      coopname,
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      actual_amount: '100.0000 RUB',
    })
    assertTransactShape(ExpenseContract.Actions.PayExp.actionName)
  })

  it('reportExp → transact(expense, reportexp, ...)', async () => {
    await adapter.reportExp({ coopname, proposal_hash: '0xabc', item_hash: '0xdef' })
    assertTransactShape(ExpenseContract.Actions.ReportExp.actionName)
  })

  it('returnExp → transact(expense, returnexp, ...)', async () => {
    await adapter.returnExp({
      coopname,
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      return_amount: '50.0000 RUB',
    })
    assertTransactShape(ExpenseContract.Actions.ReturnExp.actionName)
  })

  it('overspendExp → transact(expense, overspendexp, ...)', async () => {
    await adapter.overspendExp({
      coopname,
      proposal_hash: '0xabc',
      item_hash: '0xdef',
      overspend_amount: '200.0000 RUB',
    })
    assertTransactShape(ExpenseContract.Actions.OverspendExp.actionName)
  })

  it('closeExp → transact(expense, closeexp, ...)', async () => {
    await adapter.closeExp({ coopname, proposal_hash: '0xabc' })
    assertTransactShape(ExpenseContract.Actions.CloseExp.actionName)
  })

  it('бросает 502, если vault не отдал ключ', async () => {
    vault.getWif.mockResolvedValueOnce(null)
    await expect(adapter.closeExp({ coopname, proposal_hash: '0xabc' })).rejects.toThrow(
      'Не найден приватный ключ'
    )
    expect(blockchain.initialize).not.toHaveBeenCalled()
    expect(blockchain.transact).not.toHaveBeenCalled()
  })
})
