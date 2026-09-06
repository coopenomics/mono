import { beforeAll, describe, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { generator, mongoUri } from './utils'
import { testDocumentGeneration } from './utils/testDocument'

beforeAll(async () => {
  generator.connect(mongoUri)
})

/**
 * Документы паевой модели Стола заказов (компонент 68): выдача товара пайщику
 * (1113 → 1114 → 1115) и гарантийный возврат (1116 → 1117). Снятые вместе с
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
      braname: 'branch1',
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
      braname: 'branch1',
      fact_quantity: 10,
      total_amount: '1000.0000',
      ...goods,
    })
  })

  it('генерируем заявление на гарантийный возврат товара', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceShareContributionStatement.Action>({
      registry_id: Cooperative.Registry.MarketplaceShareContributionStatement.registry_id,
      coopname: 'voskhod',
      username: 'entrepreneur',
      order_id: '1',
      order_hash: '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce',
      braname: 'branch1',
      reason_text: 'Товар не соответствует заявленному качеству.',
      actual_quantity: 2,
      fact_cost: '200.0000',
      ...goods,
    })
  })

  it('генерируем решение совета о гарантийном возврате товара', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceShareContributionDecision.Action>({
      registry_id: Cooperative.Registry.MarketplaceShareContributionDecision.registry_id,
      coopname: 'voskhod',
      username: 'entrepreneur',
      decision_id: 1,
      order_hash: '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce',
      actual_quantity: 2,
      fact_cost: '200.0000',
      ...goods,
    })
  })
})
