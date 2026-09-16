import { expect } from 'vitest'
import { CapitalContract, SovietContract } from 'cooptypes'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import { generateRandomSHA256 } from '../../utils/randomHash'
import { getCoopProgramWallet, getUserProgramWallet } from '../wallet/walletUtils'
import { processDecision } from '../soviet/processDecision'
import { consoleIt } from '../shared'
import { processApprove } from './processApprove'
import { getSegment } from './getSegment'
import { capitalProgramId, walletProgramId } from './consts'

export async function investInProject(
  blockchain: any,
  coopname: string,
  investor: string,
  projectHash: string,
  investAmount: string,
  fakeDocument: any,
) {
  const investHash = generateRandomSHA256()
  console.log(`\n🔹 Начало инвестиции: ${investHash}`)

  const prevProject = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    'projects',
    1,
    projectHash,
    projectHash,
    3,
    'sha256',
  ))[0] || { invested: '0.0000 RUB', available: '0.0000 RUB' }

  const prevWalletWallet = await getUserProgramWallet(blockchain, coopname, investor, walletProgramId) || { blocked: '0.0000 RUB' }
  const prevUserWallet = await getUserProgramWallet(blockchain, coopname, investor, capitalProgramId) || { blocked: '0.0000 RUB' }
  const prevProgramWallet = await getCoopProgramWallet(blockchain, coopname, capitalProgramId) || { blocked: '0.0000 RUB', share_contributions: '0.0000 RUB' }

  console.log('📊 Балансы до инвестиции:')
  console.log('▶ Проект:', prevProject)
  console.log('▶ Главный кошелек пользователя:', prevWalletWallet)
  console.log('▶ Кошелек пользователя (благорост):', prevUserWallet)
  console.log('▶ Кошелек программы (благорост):', prevProgramWallet)
  console.log('▶ Сумма инвестиции: ', investAmount)
  // Создание инвестиции
  const createInvestData: CapitalContract.Actions.CreateProjectInvest.ICreateInvest = {
    coopname,
    project_hash: projectHash,
    username: investor,
    invest_hash: investHash,
    amount: investAmount,
    statement: fakeDocument,
  }

  console.log(`\n🚀 Отправка транзакции CreateInvest для ${investor} на сумму ${investAmount}`)
  const createInvestResult = await blockchain.api.transact(
    {
      actions: [
        {
          account: CapitalContract.contractName.production,
          name: CapitalContract.Actions.CreateProjectInvest.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data: createInvestData,
        },
      ],
    },
    {
      blocksBehind: 3,
      expireSeconds: 30,
    },
  )
  consoleIt(createInvestResult)
  getTotalRamUsage(createInvestResult)
  expect(createInvestResult.transaction_id).toBeDefined()

  // const blockchainInvest = (await blockchain.getTableRows(
  //   CapitalContract.contractName.production,
  //   coopname,
  //   'invests',
  //   1,
  //   investHash,
  //   investHash,
  //   2,
  //   'sha256',
  // ))[0]

  // console.log('🔍 Инвестиция в блокчейне:', blockchainInvest)
  // expect(blockchainInvest).toBeDefined()
  // expect(blockchainInvest.status).toBe('created')

  // Утверждение инвестиции
  // console.log(`\n✅ Подтверждение инвестиции ${investHash}`)
  // const approveInvestResult = await processApprove(blockchain, coopname, investHash)

  // Проверка утвержденной инвестиции
  const blockchainEmptyInvest = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    'invests',
    1,
    investHash,
    investHash,
    2,
    'sha256',
  ))[0]

  // Инвестиция удаляется после утверждения
  expect(blockchainEmptyInvest).toBeUndefined()

  const finalProject = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    'projects',
    1,
    projectHash,
    projectHash,
    3,
    'sha256',
  ))[0]

  const finalUserWallet = await getUserProgramWallet(blockchain, coopname, investor, capitalProgramId)
  const finalProgramWallet = await getCoopProgramWallet(blockchain, coopname, capitalProgramId)

  // Получение сегмента инвестора для данного проекта
  const segment = await getSegment(blockchain, coopname, projectHash, investor)

  console.log('\n📊 Балансы после инвестиции:')
  console.log('▶ Проект:', finalProject)
  console.log('▶ Сегмент:', segment)
  console.log('▶ Кошелек пользователя (благорост):', finalUserWallet)
  console.log('▶ Кошелек программы (благорост):', finalProgramWallet)

  // Кошелёк пайщика обязан существовать после инвестиции: если его нет,
  // средства никуда не легли и сравнивать балансы не с чем.
  if (!finalUserWallet)
    throw new Error(`Кошелёк пайщика ${investor} в программе ${capitalProgramId} не найден после инвестиции`)

  // Проверка изменения балансов
  expect(parseFloat(finalUserWallet.blocked)).toBeCloseTo(parseFloat(prevUserWallet.blocked) + parseFloat(investAmount), 1)
  expect(parseFloat(finalProgramWallet.blocked)).toBeCloseTo(parseFloat(prevProgramWallet.blocked) + parseFloat(investAmount), 1)

  console.log(`\n✅ Инвестирование на ${investAmount} завершено успешно!`)

  return {
    investHash,
    // invest: blockchainInvest,
    transactionId: createInvestResult.transaction_id,
    prevProject,
    project: finalProject,
    segment,
  }
}
