/**
 * Оперативная память цепи: паевой взнос пайщика через кассу кооператива.
 *
 * Путь рабочего стола: пайщик заводит паевой платёж, председатель (кассир)
 * отмечает его оплаченным, шлюз проводит взнос в цепи и пополняет главный
 * паевой кошелёк пайщика.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, freshMember, gql, login, tokenOf, waitFor } from '../core'
import { SET_STATUS, createDeposit, paymentByHash } from '../payments/payments.helpers'
import { ProcessMeter, RAM_COST_ON } from './ram-cost.helpers'

const pm = new ProcessMeter('share-deposit', 'паевой взнос через кассу (от платежа до зачисления)', {
  created: { title: 'Паевой платёж заведён', awaits: 'отметки об оплате кассиром' },
  completed: { title: 'Платёж оплачен, взнос зачислен на паевой кошелёк', awaits: '—' },
}, {
  // Допущение: деньги приходят на счёт кооператива за сутки.
  created: 1,
})

describe.runIf(RAM_COST_ON)('оперативная память: паевой взнос через кассу', () => {
  afterAll(() => pm.finish(), 120_000)

  it('платёж проходит путь до зачисления, память снимается на каждом этапе', async () => {
    const payer = freshMember({ prefix: 'ramdp' })
    const token = await login(payer)
    const chairToken = await tokenOf(CHAIRMAN)
    await pm.start()

    const deposit = await createDeposit(token, payer.account, 1000)
    await pm.mark('created')

    await gql(chairToken, SET_STATUS, { d: { id: deposit.id, status: 'PAID' } })
    const done = await waitFor(async () => {
      const p = await paymentByHash(token, deposit.hash, { username: payer.account })
      return p?.status === 'COMPLETED' ? p : null
    }, { timeoutMs: 120_000, intervalMs: 2_000, label: 'паевой платёж завершён' })
    expect(done.status).toBe('COMPLETED')
    await pm.mark('completed')

    expect(pm.passed()).toEqual(['before', ...Object.keys(pm.stages)])
  }, 900_000)
})
