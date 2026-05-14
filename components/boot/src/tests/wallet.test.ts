import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { globalRamStats } from '../utils/getTotalRamUsage'
import { signWalletAgreement } from './wallet/signWalletAgreement'
import { depositToWallet } from './wallet/depositToWallet'
import { fakeDocument } from './shared/fakeDocument'

const blockchain = new Blockchain(config.network, config.private_keys)

beforeAll(async () => {
  await blockchain.update_pass_instance()
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
    expect(wallet).toBeDefined()
    expect(program).toBeDefined()
  })

  it('совершаем депозит в ЦПП кошелька', async () => {
    const { depositId, program, userWallet } = await depositToWallet(blockchain, 'voskhod', 'ant', 100.0)
    expect(depositId).toBeDefined()
    expect(program).toBeDefined()
    expect(userWallet).toBeDefined()
  }, 20_000)
})
