/**
 * Оперативная память цепи: вступление пайщика в кооператив.
 *
 * Путь формы вступления: гость заводит учётную запись, подписывает документы
 * кооператива и заявление о вступлении, оплачивает вступительный и
 * минимальный паевой взносы; кассир отмечает платёж оплаченным, вопрос о
 * приёме встаёт на повестку совета, совет принимает пайщика. На стенде решение
 * о приёме принимает робот совета (предустановка globalSetup api-tests).
 *
 * Пайщик остаётся в кооперативе, поэтому положительный итог после приёма —
 * это память, которую занимает каждый принятый пайщик.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, gql, tableRows, tokenOf, waitFor } from '../core'
import { SET_STATUS } from '../payments/payments.helpers'
import { applicant, fullApplication } from '../registration/registration.helpers'
import { ProcessMeter, RAM_COST_ON } from './ram-cost.helpers'

const pm = new ProcessMeter('registration', 'вступление пайщика в кооператив (от учётной записи до приёма советом)', {
  account: { title: 'Учётная запись заведена', awaits: 'заявления о вступлении' },
  applied: { title: 'Заявление и документы подписаны', awaits: 'вступительного платежа' },
  payment: { title: 'Вступительный платёж заведён', awaits: 'отметки об оплате кассиром' },
  paid: { title: 'Платёж оплачен, вопрос о приёме у совета', awaits: 'решения совета' },
  admitted: { title: 'Совет принял пайщика', awaits: '—' },
}, {
  // Допущения: оплата — сутки, решение совета — неделя.
  payment: 1,
  paid: 7,
})

describe.runIf(RAM_COST_ON)('оперативная память: вступление пайщика', () => {
  afterAll(() => pm.finish(), 120_000)

  it('вступление проходит путь до приёма советом, память снимается на каждом этапе', async () => {
    const chairToken = await tokenOf(CHAIRMAN)
    await pm.start()

    const a = await applicant('ramjn')
    await pm.mark('account')

    const r = await fullApplication(a)
    expect(r.errors, `заявление принято: ${JSON.stringify(r.errors)}`).toEqual([])
    await pm.mark('applied')

    const payment = (await gql<any>(a.token, 'mutation($d:CreateInitialPaymentInput!){ createInitialPayment(data:$d){ id hash status } }', {
      d: { username: a.username },
    })).createInitialPayment
    await pm.mark('payment')

    await gql(chairToken, SET_STATUS, { d: { id: payment.id, status: 'PAID' } })
    await pm.mark('paid')

    await waitFor(async () => ((await tableRows<any>('soviet', COOP, 'participants', { lower: a.username, upper: a.username })).length ? true : null),
      { timeoutMs: 300_000, intervalMs: 3_000, label: `пайщик ${a.username} принят советом` })
    await pm.mark('admitted')

    expect(pm.passed()).toEqual(['before', ...Object.keys(pm.stages)])
  }, 1_200_000)
})
