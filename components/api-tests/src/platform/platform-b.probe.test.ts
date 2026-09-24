/**
 * Разведка platform-b (временный файл, в сдачу не идёт): доказательства багов
 * для отчёта — разметка в банковских реквизитах мимо проверки.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, gql, randomAccount, tokenOf } from '../core'
import { REGISTER_ACCOUNT, bankAccount, freshKeyPair, gqlFull, individualData, registerInput } from './platform-b.helpers'

describe('разведка platform-b', () => {
  it('банковский счёт с разметкой: добавление и правка', async () => {
    const username = randomAccount('prb')
    const { publicKey } = await freshKeyPair()
    await gql(null, REGISTER_ACCOUNT, { d: registerInput(username, publicKey, 'individual', individualData()) })
    const token = await tokenOf(CHAIRMAN)
    const add = await gqlFull(token, `mutation($d:AddPaymentMethodInput!){ addPaymentMethod(data:$d){ method_id data{ ... on BankAccount { bank_name } } } }`, {
      d: { username, is_default: false, bank_transfer_data: bankAccount({ bank_name: 'Банк <script>x</script>' }) },
    })
    console.log('PROBE addPaymentMethod', JSON.stringify(add.data ?? add.errors).slice(0, 600))
    const methodId = add.data?.addPaymentMethod?.method_id
    if (methodId) {
      const upd = await gqlFull(token, `mutation($d:UpdateBankAccountInput!){ updateBankAccount(data:$d){ method_id data{ ... on BankAccount { bank_name } } } }`, {
        d: { username, method_id: methodId, is_default: false, data: bankAccount({ bank_name: 'Банк <img src=x onerror=alert(1)>' }) },
      })
      console.log('PROBE updateBankAccount', JSON.stringify(upd.data ?? upd.errors).slice(0, 600))
    }
    expect(true).toBe(true)
  })
})
