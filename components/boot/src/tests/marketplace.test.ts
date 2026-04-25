import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { getTotalRamUsage, globalRamStats } from '../utils/getTotalRamUsage'
import { addUser } from '../init/participant'
import { generateRandomUsername } from '../utils/randomUsername'

const blockchain = new Blockchain(config.network, config.private_keys)

let supplier: string
let customer: string

const fakeDocument = {
  hash: '157192B276DA23CC84AB078FC8755C051C5F0430BF4802E55718221E6B76C777',
  public_key: 'PUB_K1_5JhMfxbsNebajHcTEK8yC9uNN9Dit9hEmzE8ri8yMhhzzEtUA4',
  signature: 'SIG_K1_KmKWPBC8dZGGDGhbKEoZEzPr3h5crRrR2uLdGRF5DJbeibY1MY1bZ9sPwHsgmPfiGFv9psfoCVsXFh9TekcLuvaeuxRKA8',
  meta: '{}',
}

const testHash = '0000000000000000000000000000000000000000000000000000000000000001'

beforeAll(async () => {
  await blockchain.update_pass_instance()

  supplier = generateRandomUsername()
  customer = generateRandomUsername()

  console.log('supplier:', supplier)
  console.log('customer:', customer)

  await addUser(supplier)
  await addUser(customer)
}, 500_000)

afterAll(() => {
  console.log('\n📊 **MARKETPLACE RAM USAGE** 📊')
  let total = 0
  for (const [key, ram] of Object.entries(globalRamStats)) {
    console.log(`  ${key} = ${(ram / 1024).toFixed(2)} kb`)
    total += ram
  }
  console.log(`\n💾 **TOTAL**: ${(total / 1024).toFixed(2)} kb\n`)
})

describe('Marketplace — orderoffer flow', () => {
  it('контракт marketplace задеплоен', async () => {
    const info = await blockchain.api.v1.chain.get_info()
    expect(info).toBeDefined()
    expect(info.chain_id).toBeDefined()
  })

  it('создание заявки orderoffer (заказчик)', async () => {
    const coopname = config.coopname

    const result = await blockchain.transact({
      account: 'marketplace',
      name: 'orderoffer',
      authorization: [{ actor: coopname, permission: 'active' }],
      data: {
        coopname,
        receiver_braname: coopname,
        username: customer,
        hash: testHash,
        units: 10,
        unit_cost: '100.0000 RUB',
        product_lifecycle_secs: 2592000,
        warranty_period_secs: 604800,
        membership_fee_amount: '50.0000 RUB',
        cancellation_fee_amount: '10.0000 RUB',
        convert_in: fakeDocument,
        meta: JSON.stringify({ title: 'Тестовый товар', description: 'Описание' }),
      },
    })

    expect(result).toBeDefined()
    console.log('orderoffer tx:', result?.response?.transaction_id?.substring(0, 16))

    const ramUsed = await getTotalRamUsage(coopname)
    globalRamStats['orderoffer'] = ramUsed
  })

  it('принятие заявки поставщиком (accept)', async () => {
    const coopname = config.coopname

    const result = await blockchain.transact({
      account: 'marketplace',
      name: 'accept',
      authorization: [{ actor: coopname, permission: 'active' }],
      data: {
        coopname,
        supplier_braname: coopname,
        username: supplier,
        request_hash: testHash,
        convert_out: fakeDocument,
        product_contribution_statement: fakeDocument,
      },
    })

    expect(result).toBeDefined()
    console.log('accept tx:', result?.response?.transaction_id?.substring(0, 16))

    const ramUsed = await getTotalRamUsage(coopname)
    globalRamStats['accept'] = ramUsed
  })
})

describe('Marketplace — coopstock flow', () => {
  const stockHash = '0000000000000000000000000000000000000000000000000000000000000002'

  it('создание предложения из запасов кооператива', async () => {
    const coopname = config.coopname

    const result = await blockchain.transact({
      account: 'marketplace',
      name: 'coopstock',
      authorization: [{ actor: coopname, permission: 'active' }],
      data: {
        coopname,
        braname: coopname,
        hash: stockHash,
        units: 5,
        unit_cost: '50.0000 RUB',
        product_lifecycle_secs: 1296000,
        warranty_period_secs: 302400,
        membership_fee_amount: '25.0000 RUB',
        meta: JSON.stringify({ title: 'Уценённый товар', description: 'Из запасов' }),
      },
    })

    expect(result).toBeDefined()
    console.log('coopstock tx:', result?.response?.transaction_id?.substring(0, 16))
  })
})
