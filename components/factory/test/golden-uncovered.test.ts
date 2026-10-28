/**
 * Документы, которых не было в наборе тестов до шага 0 фабрики v2.
 *
 * Эталон нужен каждому из 92 видов: иначе рефакторинг молча изменит вывод
 * документа, который никто не собирал в тестах. Здесь — одиннадцать видов,
 * которые остальные файлы набора не вызывали. Проверка полноты —
 * `scripts/golden-coverage.mjs`.
 *
 * Входные данные синтетические, субъекты — из `test/utils/index.ts`
 * (`ant`, `entrepreneur`, `exampleorg`, участок `branch`).
 */
import { beforeAll, describe, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { generator, mongoUri } from './utils'
import { testDocumentGeneration } from './utils/testDocument'

beforeAll(async () => {
  await generator.connect(mongoUri)
})

const ORDER_HASH = '917f7443a115d495574dbe73405b7b6be3fed929526ba736228f3ff234ad7fce'

describe('эталоны документов, которых не было в наборе', () => {
  it('699 соглашение ЦПП «Соседи»', async () => {
    await testDocumentGeneration<Cooperative.Registry.SosediAgreement.Action>({
      registry_id: Cooperative.Registry.SosediAgreement.registry_id,
      coopname: 'voskhod',
      username: 'ant',
    })
  })

  it('1095 заявление о конвертации паевого взноса в оплату ресурсов', async () => {
    await testDocumentGeneration<Cooperative.Registry.BillingConversionStatement.Action>({
      registry_id: Cooperative.Registry.BillingConversionStatement.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      convert_amount: '1000.0000 RUB',
    })
  })

  it('1100 положение ЦПП «Стол заказов»', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceProgramTemplate.Action>({
      registry_id: Cooperative.Registry.MarketplaceProgramTemplate.registry_id,
      coopname: 'voskhod',
      username: 'ant',
    })
  })

  it('1102 оферта ЦПП «Стол заказов»', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceOffer.Action>({
      registry_id: Cooperative.Registry.MarketplaceOffer.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      marketplace_agreement_number: 'СЗ-001/2026',
      marketplace_agreement_created_at: '2026-06-15T10:00:00.000Z',
    })
  })

  it('1103 товарно-транспортная накладная', async () => {
    const { hash: doc_data_hash } = await generator.saveDocData({
      expeditor_full_name: 'Петров Пётр Петрович',
      expeditor_phone: '+79990000000',
      vehicle_number: 'А123ВВ77',
      loading_address: 'г. Москва, ул. Складская, д. 1',
      loading_datetime: '2026-10-27T08:00:00.000Z',
      delivery_datetime_estimate: '2026-10-27T12:00:00.000Z',
    }, Cooperative.Registry.MarketplaceTransportNote.registry_id)

    await testDocumentGeneration<Cooperative.Registry.MarketplaceTransportNote.Action>({
      registry_id: Cooperative.Registry.MarketplaceTransportNote.registry_id,
      coopname: 'voskhod',
      username: 'exampleorg',
      ttn_number: 'ТТН-0001',
      cycle_id: '1',
      shipment_id: '1',
      accept_braname: 'branch',
      supplier_account: 'exampleorg',
      total_amount: '1000.0000',
      currency: 'RUB',
      doc_data_hash,
    })
  })

  it('1104 акт приёма-передачи имущества на участке', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceAplReception.Action>({
      registry_id: Cooperative.Registry.MarketplaceAplReception.registry_id,
      coopname: 'voskhod',
      username: 'exampleorg',
      order_id: '1',
      order_hash: ORDER_HASH,
      act_id: '1',
      transmitter: 'ant',
      braname: 'branch',
      accept_braname: 'branch',
      reception_id: '1',
      fact_quantity: 10,
      total_amount: '1000.0000',
      supplier_account: 'exampleorg',
      sku: 'offer-1',
      product_title: 'Молоко «Бурёнка»',
      unit_of_measurement: 'Литр',
      unit_cost: '100.0000',
      currency: 'RUB',
    })
  })

  it('1109 заявление о финансовой помощи участку', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchFinancialAidStatement.Action>({
      registry_id: Cooperative.Registry.BranchFinancialAidStatement.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      aid_hash: ORDER_HASH,
      braname: 'branch',
      amount: '5000.0000 RUB',
    })
  })

  it('1110 заявление о конвертации паевого взноса в членский (Стол заказов)', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceConvertStatement.Action>({
      registry_id: Cooperative.Registry.MarketplaceConvertStatement.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      order_hash: ORDER_HASH,
      amount: '1000.0000 RUB',
      membership_fee: '100.0000 RUB',
    })
  })

  it('1111 служебная записка о списании', async () => {
    await testDocumentGeneration<Cooperative.Registry.MarketplaceWriteoffServiceMemo.Action>({
      registry_id: Cooperative.Registry.MarketplaceWriteoffServiceMemo.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      proposal_hash: ORDER_HASH,
      braname: 'branch',
      branch_name: 'КУ ПЕТРУШКА',
      cycle_started_at: '2026-10-01T00:00:00.000Z',
      items: [
        { asset_title: 'Молоко «Бурёнка»', quantity: '2', unit: 'л', amount: '200.0000', reason: 'просрочка' },
        { asset_title: 'Хлеб «Бородинский»', quantity: '1', unit: 'шт.', amount: '60.0000', reason: 'порча' },
      ],
      total_amount: '260.0000',
    })
  })

  it('1112 протокол совета о финансовой помощи участку', async () => {
    await testDocumentGeneration<Cooperative.Registry.BranchFinancialAidProtocol.Action>({
      registry_id: Cooperative.Registry.BranchFinancialAidProtocol.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      decision_id: 1,
      aid_hash: ORDER_HASH,
      receiver: 'ant',
      braname: 'branch',
      amount: '5000.0000 RUB',
    })
  })

  it('3011 заявление о конвертации паевого взноса (Образование)', async () => {
    await testDocumentGeneration<Cooperative.Registry.EducationConvertStatement.Action>({
      registry_id: Cooperative.Registry.EducationConvertStatement.registry_id,
      coopname: 'voskhod',
      username: 'ant',
      sub_hash: ORDER_HASH,
      amount: '3000.0000 RUB',
      from_program: 'Образование',
      total: '3000.0000 RUB',
      course_title: 'Курс рисования',
      period: 'октябрь 2026',
    })
  })
})
