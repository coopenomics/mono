import { GatewayContract, RegistratorContract, SovietContract } from 'cooptypes'
import { expect } from 'vitest'
import { generateRandomSHA256 } from '../../utils/randomHash'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import { processDecision } from '../soviet/processDecision'
import { getParticipant } from '../registrator/getParticipant'
import { fakeDocument } from '../soviet/fakeDocument'
import { compareTokenAmounts, getLedgerAccountById } from '../wallet/walletUtils'

// Идентификаторы счетов ledger2 (id = code × 1000). После рефакторинга
// Epic 1 проверка балансов идёт по двойной записи на 80 (паевой фонд) и
// 86 (целевое финансирование), а не по legacy fund::coopwallet —
// последний обновлялся через Ledger::add, который удалён вместе с переходом
// на ledger2.apply.
const LEDGER2_SHARE_FUND_ID = 80_000        // 80 — Паевой фонд (passive)
const LEDGER2_TARGET_RECEIPTS_ID = 86_000   // 86 — Целевое финансирование (passive)

export async function registerUser(blockchain: any, coopname: string, username: string) {
  const registration_hash = generateRandomSHA256()

  const account = await blockchain.generateKeypair(username, undefined, 'Аккаунт кооператива')

  // 🔹 Получаем балансы до регистрации (по двойной записи ledger2)
  const prevShareFund = await getLedgerAccountById(blockchain, coopname, LEDGER2_SHARE_FUND_ID)
  const prevTargetReceipts = await getLedgerAccountById(blockchain, coopname, LEDGER2_TARGET_RECEIPTS_ID)
  console.log('📦 ledger2 BEFORE: 80=', prevShareFund.available, '86=', prevTargetReceipts.available)

  // 🔹 1. Создание аккаунта
  {
    const data: RegistratorContract.Actions.CreateAccount.ICreateAccount = {
      coopname,
      referer: '',
      username,
      public_key: account.publicKey,
      meta: '',
    }

    const result = await blockchain.api.transact({
      actions: [{
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.CreateAccount.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    getTotalRamUsage(result)
    console.log('✅ Аккаунт создан')
  }

  // 🔹 2. Регистрация пайщика
  {
    const data: RegistratorContract.Actions.RegisterUser.IRegisterUser = {
      coopname,
      braname: '',
      username,
      type: 'individual',
      statement: fakeDocument,
      registration_hash,
    }

    const result = await blockchain.api.transact({
      actions: [{
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.RegisterUser.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    getTotalRamUsage(result)
    console.log('✅ Пайщик зарегистрирован')
  }

  // 🔹 3. Подтверждение прихода
  {
    const data: GatewayContract.Actions.CompleteIncome.ICompleteIncome = {
      coopname,
      income_hash: registration_hash,
    }

    const result = await blockchain.api.transact({
      actions: [{
        account: GatewayContract.contractName.production,
        name: GatewayContract.Actions.CompleteIncome.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    getTotalRamUsage(result)
    console.log('✅ Приход подтвержден')
  }

  // 🔹 4. Исполнение решения
  const decisions = await blockchain.getTableRows(
    SovietContract.contractName.production,
    coopname,
    'decisions',
    1000,
  )
  const lastDecision = decisions.at(-1)
  console.log('📜 Последнее решение:', lastDecision)
  await processDecision(blockchain, lastDecision.id)
  console.log('✅ Решение выполнено')

  // 🔹 5. Проверка участника
  const participant = await getParticipant(blockchain, coopname, username)
  console.log('🙋 Участник:', participant)

  expect(participant).toBeDefined()
  expect(participant.has_vote).toBe(1)
  expect(participant.status).toBe('accepted')
  expect(participant.username).toBe(username)

  // 🔹 6. Проверка балансов после регистрации (двойная запись ledger2)
  // confirmreg → 2 × Ledger2::apply:
  //   - operations::registrator::PUT_MINSHARE  (Dr 51 / Cr 80, +minimum  на 80)
  //   - operations::registrator::PAY_ENTRANCE  (Dr 51 / Cr 86, +initial  на 86)
  // Оба счёта пассивные → balance = credit − debit; растёт при кредитовании.
  const newShareFund = await getLedgerAccountById(blockchain, coopname, LEDGER2_SHARE_FUND_ID)
  const newTargetReceipts = await getLedgerAccountById(blockchain, coopname, LEDGER2_TARGET_RECEIPTS_ID)
  console.log('💰 ledger2 AFTER: 80=', newShareFund.available, '86=', newTargetReceipts.available)

  const minAmount = parseFloat(participant.minimum_amount.split(' ')[0])
  const initAmount = parseFloat(participant.initial_amount.split(' ')[0])

  compareTokenAmounts(prevShareFund.available, newShareFund.available, minAmount)
  compareTokenAmounts(prevTargetReceipts.available, newTargetReceipts.available, initAmount)

  return participant
}
