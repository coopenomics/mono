import { expect } from 'vitest'
import { CapitalContract, GatewayContract } from 'cooptypes'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import { generateRandomSHA256 } from '../../utils/randomHash'
import { processLastDecision } from '../soviet/processLastDecision'
import type Blockchain from '../../blockchain'
import { formatDateToISOString } from '../shared/formatDateToISOString'
import { processApprove } from './processApprove'
import { getSegment } from './getSegment'

export async function processDebt(
  blockchain: Blockchain,
  coopname: string,
  username: string,
  projectHash: string,
  debtAmount: string,
  fakeDocument: any,
  repaidAtDate: Date,
) {
  const debtHash = generateRandomSHA256()
  console.log(`\n🔹 Начало процесса создания долга: ${debtHash}`)

  // Дата возврата через месяц
  const repaidAt = formatDateToISOString(repaidAtDate)

  // Получаем сегмент до создания долга
  const segmentBefore = await getSegment(blockchain, coopname, projectHash, username)
  console.log('📊 Сегмент до долга:', segmentBefore)

  // Получаем контрибьютора до создания долга
  const contributorsBefore = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    'contributors',
    1,
    username,
    username,
    2,
    'i64',
  ))
  const contributorBefore = contributorsBefore[0]
  console.log('📊 Контрибьютор до долга:', contributorBefore)

  fakeDocument.signatures[0].signer = username

  // 1. Создаем долг
  const createDebtData: CapitalContract.Actions.CreateDebt.ICreateDebt = {
    coopname,
    username,
    debt_hash: debtHash,
    project_hash: projectHash,
    amount: debtAmount,
    repaid_at: repaidAt,
    statement: fakeDocument,
  }

  console.log(`\n🚀 Отправка транзакции CreateDebt для ${username} на сумму ${debtAmount}`)
  const createDebtResult = await blockchain.api.transact(
    {
      actions: [
        {
          account: CapitalContract.contractName.production,
          name: CapitalContract.Actions.CreateDebt.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data: createDebtData,
        },
        // Договор займа уходит той же транзакцией: с ним заявление становится повесткой совета.
        {
          account: CapitalContract.contractName.production,
          name: CapitalContract.Actions.DebtContract.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data: { coopname, username, debt_hash: debtHash, contract: fakeDocument },
        },
      ],
    },
    {
      blocksBehind: 3,
      expireSeconds: 30,
    },
  )

  getTotalRamUsage(createDebtResult)
  expect(createDebtResult.transaction_id).toBeDefined()
  console.log('✅ Долг создан:', debtHash)

  // Проверяем что долг создался
  const debts = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    'debts',
    1,
    debtHash,
    debtHash,
    3,
    'sha256',
  ))
  const createdDebt = debts[0]
  console.log('🔍 Долг в блокчейне:', createdDebt)
  expect(createdDebt).toBeDefined()
  expect(createdDebt.status).toBe('pending')

  // 2. Решение совета: заём разрешён, договор уходит председателю на подпись
  await processLastDecision(blockchain, coopname)
  console.log('✅ Решение совета принято (договор ждёт подписи председателя)')

  // 3. Председатель подписывает договор — заём передан кассиру
  fakeDocument.signatures[0].signer = username
  await processApprove(blockchain, coopname, debtHash)
  fakeDocument.signatures[0].signer = username
  console.log('✅ Договор подписан председателем (outcome создан)')

  // 4. Подтверждаем завершение вывода (gateway сам вызовет callback на capital)
  const confirmOutcomeData: GatewayContract.Actions.CompleteOutcome.ICompleteOutcome = {
    coopname,
    outcome_hash: debtHash,
  }

  console.log(`\n✅ Подтверждение завершения вывода`)
  const confirmResult = await blockchain.api.transact(
    {
      actions: [
        {
          account: GatewayContract.contractName.production,
          name: GatewayContract.Actions.CompleteOutcome.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data: confirmOutcomeData,
        },
      ],
    },
    {
      blocksBehind: 3,
      expireSeconds: 30,
    },
  )

  getTotalRamUsage(confirmResult)
  expect(confirmResult.transaction_id).toBeDefined()
  console.log('✅ Оплата долга подтверждена')

  // Получаем финальные состояния
  const segmentAfter = await getSegment(blockchain, coopname, projectHash, username)

  const contributorsAfter = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    'contributors',
    1,
    username,
    username,
    2,
    'i64',
  ))
  const contributorAfter = contributorsAfter[0]

  // Получаем долг после подтверждения оплаты
  const debtsAfter = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    'debts',
    1,
    debtHash,
    debtHash,
    3,
    'sha256',
  ))
  const debtAfter = debtsAfter[0]

  // Выданный заём встал в общий реестр беспроцентных займов: источник — capital, ссылка — проект.
  const registry = (await blockchain.getTableRows('debt', coopname, 'debts', 1, debtHash, debtHash, 3, 'sha256'))
  const registered = registry[0]
  expect(registered, 'заём Генерации зарегистрирован в общем реестре').toBeDefined()
  expect(registered.source).toBe(CapitalContract.contractName.production)
  expect(registered.status).toBe('issued')
  expect(registered.amount).toBe(debtAmount)
  expect(registered.remaining).toBe(debtAmount)
  expect(String(registered.source_ref).toLowerCase()).toBe(projectHash.toLowerCase())

  console.log('\n📊 Результаты после обработки долга:')
  console.log('▶ Сегмент до:', segmentBefore)
  console.log('▶ Сегмент после:', segmentAfter)
  console.log('▶ Контрибьютор до:', contributorBefore)
  console.log('▶ Контрибьютор после:', contributorAfter)
  console.log('▶ Долг после оплаты:', debtAfter)

  console.log(`\n✅ Процесс долга на ${debtAmount} завершен успешно!`)

  return {
    debtHash,
    debt: createdDebt,
    debtAfter,
    registered,
    segmentBefore,
    segmentAfter,
    contributorBefore,
    contributorAfter,
    transactionId: confirmResult.transaction_id,
  }
}
