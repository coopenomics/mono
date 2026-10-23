import { beforeAll, describe, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { generator, mongoUri } from './utils'
import { testDocumentGeneration } from './utils/testDocument'

beforeAll(async () => {
  generator.connect(mongoUri)
})

/**
 * Документы паевой модели Стола заказов (компонент 68): выдача товара пайщику
 * (1113 → 1114 → 1115) и гарантийный возврат: рекламация пайщика 1106,
 * заявление оператора об отмене сделки 1116 и протокол совета 1117. Снятые вместе с
 * членской веткой 700–702 и 800–802 здесь больше не проверяются — шаблонов
 * этих документов в фабрике нет.
 */
describe('тест генератора документов стола заказов', async () => {
  const goods = {
    sku: 'offer-1',
    product_title: 'Молоко "Бурёнка"',
    unit_of_measurement: 'Литр',
    unit_cost: '100.0000',
    currency: 'RUB',
  }

  it('генерируем заявление на выдачу товара паевым взносом', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceShareReturnStatement.Action>({
      registry_id: Cooperative.Registry.MarketplaceShareReturnStatement.registry_id,
      coopname: 'voskhod',
      username: 'entrepreneur',
      order_id: '1',
      order_hash: '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce',
      braname: 'branch',
      fact_quantity: 10,
      total_amount: '1000.0000',
      ...goods,
    })
  })

  it('генерируем решение совета о выдаче товара паевым взносом', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceShareReturnDecision.Action>({
      registry_id: Cooperative.Registry.MarketplaceShareReturnDecision.registry_id,
      coopname: 'voskhod',
      username: 'entrepreneur',
      decision_id: 1,
      order_hash: '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce',
      fact_quantity: 10,
      total_amount: '1000.0000',
      ...goods,
    })
  })

  it('генерируем акт о выдаче товара паевым взносом', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceShareReturnAct.Action>({
      registry_id: Cooperative.Registry.MarketplaceShareReturnAct.registry_id,
      coopname: 'voskhod',
      username: 'entrepreneur',
      order_id: '1',
      order_hash: '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce',
      decision_id: 1,
      act_id: '123',
      transmitter: 'ant',
      braname: 'branch',
      fact_quantity: 10,
      total_amount: '1000.0000',
      ...goods,
    })
  })

  it('генерируем рекламацию пайщика — заявление о гарантийном возврате имущества', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceReturnStatement.Action>({
      registry_id: Cooperative.Registry.MarketplaceReturnStatement.registry_id,
      coopname: 'voskhod',
      username: 'entrepreneur',
      order_id: '1',
      order_hash: '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce',
      braname: 'branch',
      reason_text: 'Товар не соответствует заявленному качеству.',
      actual_quantity: 2,
      fact_cost: '200.0000',
      ...goods,
    })
  })

  const cancel = {
    order_id: '1',
    order_hash: '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce',
    request_hash: '3c9f2b1e5d7a4f6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c',
    braname: 'branch',
    orderer: 'entrepreneur',
    operator: 'ant',
    issue_decision_id: 1,
    actual_quantity: 2,
    fact_cost: '200.0000',
    fee_refund: '20.0000',
    total_refund: '220.0000',
    reason_text: 'Товар не соответствует заявленному качеству.',
    inspection_result: 'Упаковка вскрыта при пайщике, продукт испорчен.',
    ...goods,
  }

  it('генерируем заявление оператора участка об отмене сделки по гарантийному возврату', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceReturnCancelStatement.Action>({
      registry_id: Cooperative.Registry.MarketplaceReturnCancelStatement.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      ...cancel,
    })
  })

  it('генерируем протокол решения совета об отмене сделки по гарантийному возврату', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceReturnCancelDecision.Action>({
      registry_id: Cooperative.Registry.MarketplaceReturnCancelDecision.registry_id,
      coopname: 'voskhod',
      username: 'entrepreneur',
      decision_id: 1,
      ...cancel,
    })
  })
})
