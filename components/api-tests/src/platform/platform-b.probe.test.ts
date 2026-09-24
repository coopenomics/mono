/**
 * Разведка platform-b (временный файл, в сдачу не идёт): как отказ контракта
 * в ядровой мутации доходит до клиента.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, freshMember, tokenOf } from '../core'
import { gqlFull } from './platform-b.helpers'

describe('разведка platform-b', () => {
  it('повторная верификация пайщика — отказ контракта', async () => {
    const who = freshMember({ prefix: 'prb' })
    const token = await tokenOf(CHAIRMAN)
    const Q = 'mutation($d:VerifyParticipantOnsiteInput!){ verifyParticipantOnsite(data:$d){ type status } }'
    const first = await gqlFull(token, Q, { d: { username: who.account } })
    const second = await gqlFull(token, Q, { d: { username: who.account } })
    console.log('PROBE verify#1', JSON.stringify(first.errors))
    console.log('PROBE verify#2', JSON.stringify(second.errors))
    expect(true).toBe(true)
  })
})
