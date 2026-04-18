import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { getTotalRamUsage, globalRamStats } from '../utils/getTotalRamUsage'
import { addUser } from '../init/participant'
import { generateRandomUsername } from '../utils/randomUsername'
import { signWalletAgreement } from './wallet/signWalletAgreement'
import { depositToWallet } from './wallet/depositToWallet'
import { fakeDocument } from './shared/fakeDocument'

const blockchain = new Blockchain(config.network, config.private_keys)
let tester1: string
const walletProgramStates1: any[] = []

beforeAll(async () => {
  await blockchain.update_pass_instance()

  tester1 = generateRandomUsername()
  console.log('tester1: ', tester1)
  await addUser(tester1)
}, 500_000)

afterAll(() => {
  console.log('\n📊 **RAM USAGE SUMMARY** 📊')
  let totalGlobalRam = 0

  for (const [key, ramUsed] of Object.entries(globalRamStats)) {
    console.log(`  ${key} = ${(ramUsed / 1024).toFixed(2)} kb`)
    totalGlobalRam += ramUsed
  }

  console.log(`\n💾 **TOTAL RAM USED IN TESTS**: ${(totalGlobalRam / 1024).toFixed(2)} kb\n`)
})

describe('тест Wallet в Soviet', () => {
  it('подписываем соглашение ЦПП кошелька', async () => {
    const { wallet, program } = await signWalletAgreement(blockchain, 'voskhod', 'ant', fakeDocument)
    walletProgramStates1.push(program)
  })

  it('совершаем депозит в ЦПП кошелька', async () => {
    const { depositId, program, userWallet } = await depositToWallet(blockchain, 'voskhod', 'ant', 100.0)
    walletProgramStates1.push(program)
  }, 20_000)
})
