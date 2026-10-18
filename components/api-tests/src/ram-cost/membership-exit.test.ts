/**
 * Оперативная память цепи: выход пайщика из кооператива.
 *
 * Путь рабочего стола: пайщик подаёт заявление на выход (и заявление об
 * аннулировании соглашений об участии в программах), подтверждает его по
 * ссылке из письма — заявление уходит в цепь и встаёт на повестку совета;
 * совет голосует, председатель утверждает; кассир проводит выплату паевого
 * взноса (`gateway::outcomplete`), строка выхода стирается.
 *
 * Пайщик заводится и вносит паевой взнос до снимка «до процесса», поэтому
 * отрицательный итог после выхода — это память, которую освободил ушедший
 * пайщик.
 */
import crypto from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { COOP, authorizeDecisionOnChain, awaitDecision, deposit, freshMember, gql, latestMail, login, payOutExit, voteOnDecision, waitFor } from '../core'
import { addSbpMethod } from '../payments/payments.helpers'
import { CONFIRM_EXIT, CREATE_EXIT, exitDocuments, exitStatus } from '../membership/exit-documents.helpers'
import { ProcessMeter, RAM_COST_ON } from './ram-cost.helpers'

const pm = new ProcessMeter('membership-exit', 'выход пайщика из кооператива (от заявления до выплаты паевого взноса)', {
  requested: { title: 'Заявление на выход подано', awaits: 'подтверждения по ссылке из письма' },
  confirmed: { title: 'Выход подтверждён, вопрос на повестке совета', awaits: 'голосов членов совета' },
  voted: { title: 'Совет проголосовал', awaits: 'утверждения председателем' },
  authorized: { title: 'Выход утверждён', awaits: 'выплаты паевого взноса кассиром' },
  paid: { title: 'Паевой взнос выплачен, пайщик вышел', awaits: '—' },
}, {
  // Допущения: повестка совета — неделя, утверждение — сутки, выплата — три дня.
  confirmed: 7,
  voted: 1,
  authorized: 3,
})

describe.runIf(RAM_COST_ON)('оперативная память: выход пайщика из кооператива', () => {
  afterAll(() => pm.finish(), 120_000)

  it('выход проходит путь до выплаты, память снимается на каждом этапе', async () => {
    const leaver = freshMember({ prefix: 'ramex' })
    const token = await login(leaver)
    await addSbpMethod(token, leaver.account)
    await deposit(leaver.account, 1000)
    const hash = crypto.randomBytes(32).toString('hex')
    const documents = await exitDocuments(leaver, token, hash, { withPrograms: true })
    await pm.start()

    const d = await gql<any>(token, CREATE_EXIT, { d: { coopname: COOP, username: leaver.account, exit_hash: hash, ...documents } })
    expect(d.createMembershipExit.status).toBe('AWAITING_CONFIRMATION')
    await pm.mark('requested')

    const mail = await latestMail(leaver.email, 'membership-exit/confirm?token=', 120_000)
    const confirmToken = /membership-exit\/confirm\?token=([\w.-]+)/.exec(`${mail.text}\n${mail.html}`)?.[1]
    expect(confirmToken, 'в письме есть ссылка подтверждения').toBeTruthy()
    await gql(null, CONFIRM_EXIT, { t: confirmToken })
    await waitFor(async () => ((await exitStatus(token, leaver.account))?.status === 'PENDING' ? true : null), { timeoutMs: 60_000, intervalMs: 1_000, label: 'выход пайщика в цепи' })
    const decision = await awaitDecision(hash, `решение совета о выходе ${leaver.account}`)
    await pm.mark('confirmed')

    await voteOnDecision(Number(decision.id), 'for')
    await pm.mark('voted')

    await authorizeDecisionOnChain(Number(decision.id))
    await pm.mark('authorized')

    await payOutExit(leaver, hash)
    await pm.mark('paid')

    expect(pm.passed()).toEqual(['before', ...Object.keys(pm.stages)])
  }, 1_200_000)
})
