/**
 * Ответ мутации после факта из цепи (test-registry/sync.write-wait-delta.yaml).
 *
 * Мутация, которая пишет в цепь, отвечает, когда узел разобрал блок её
 * транзакции: дельты сохранены в базе узла, слушатели отработали. Снаружи это
 * значит одно — чтение сразу после ответа, без пауз и повторов, видит
 * записанное. Проверяется на паевом взносе через API: пайщик заводит платёж,
 * председатель отмечает его оплаченным — контроллер проводит взнос в цепи.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, caseName, freshMember, gql, login, tokenOf } from '../core'
import { mirroredAvailable } from './platform-a.helpers'

describe('sync.write-wait-delta: мутация отвечает уже изменёнными данными', () => {
  let member: Who
  let memberToken: string

  beforeAll(async () => {
    member = freshMember({ prefix: 'wwd' })
    memberToken = await login(member)
  })

  it(caseName('sync.wwd.happy.05', 'мутация с транзакцией отвечает после разбора её блока: чтение сразу после ответа видит запись'), async () => {
    const before = await mirroredAvailable(memberToken, member.account)
    const pay = await gql<any>(memberToken, `mutation($d:CreateDepositPaymentInput!){
      createDepositPayment(data:$d){ id hash status }
    }`, { d: { username: member.account, quantity: 1234, symbol: 'RUB' } })
    const payment = pay.createDepositPayment
    expect(payment.hash).toMatch(/^[0-9a-f]{64}$/i)

    await gql(await tokenOf(CHAIRMAN), `mutation($d:SetPaymentStatusInput!){
      setPaymentStatus(data:$d){ id }
    }`, { d: { id: payment.id, status: 'PAID' } })

    // Сразу после ответа — без ожидания: паевой кошелёк пайщика в зеркале узла
    // уже пополнен, а операция учёта уже в журнале процессов.
    const after = await mirroredAvailable(memberToken, member.account)
    expect(after).toBeCloseTo(before + 1234, 4)

    const proc = await gql<any>(await tokenOf(CHAIRMAN), `query($h:String!,$c:String!){
      process(hash:$h, coopname:$c){ process_type process_hash actions{ account name } }
    }`, { h: payment.hash.toLowerCase(), c: COOP })
    expect(proc.process.process_hash).toBe(payment.hash.toLowerCase())
    expect(proc.process.actions.some((a: any) => a.account === 'ledger2' && a.name === 'apply')).toBe(true)
  })
})
