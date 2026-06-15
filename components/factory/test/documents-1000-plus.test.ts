import { beforeAll, describe, it, vi } from 'vitest'
import { Cooperative } from 'cooptypes'
import { Generator } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

beforeAll(async () => {
  await generator.connect(mongoUri)

  // Подменяем метод getApprovedDecision для фабрики акта взноса результатов (1042)
  // Это позволит тесту найти "принятое решение" без обращения к реальному API
  const factory1042 = (generator as any).factories['1042']
  if (factory1042) {
    vi.spyOn(factory1042, 'getApprovedDecision').mockImplementation(async () => {
      return {
        id: 1,
        date: '19.01.2026',
        time: '10:00',
        votes_for: 2,
        votes_against: 0,
        votes_abstained: 0,
        voters_percent: 100,
      }
    })
  }

  const commonUdata = {
    coopname: 'voskhod',
    username: 'ant',
  }

  // Устанавливаем необходимые Udata для тестов
  const udatas = [
    { key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER, value: 'GEN-2026-001' },
    { key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT, value: '15.01.2026' },
    { key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER, value: 'BLG-2026-001' },
    { key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT, value: '16.01.2026' },
    { key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER, value: 'UHD-2026-001' },
    { key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT, value: '17.01.2026' },
    { key: Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER, value: 'STR-2026-001' },
    { key: Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_CREATED_AT, value: '18.01.2026' },
  ]

  for (const data of udatas) {
    await generator.save('udata', { ...commonUdata, ...data })
  }
})

describe('тест генератора документов с registry_id >= 1000', async () => {
  // Шаблоны документов ЦПП ГЕНЕРАТОР
  it('генерируем положение о целевой потребительской программе "ГЕНЕРАТОР"', async () => {
    await testDocumentGeneration({
      registry_id: 994,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем шаблон пользовательского соглашения (оферты) по участию в целевой потребительской программе "ГЕНЕРАТОР"', async () => {
    await testDocumentGeneration({
      registry_id: 995,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем пользовательское соглашение (оферту) по участию в целевой потребительской программе "ГЕНЕРАТОР"', async () => {
    await testDocumentGeneration({
      registry_id: 996,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  // Шаблоны документов
  it('генерируем шаблон договора участия в хозяйственной деятельности', async () => {
    await testDocumentGeneration({
      registry_id: 997,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  // Шаблоны документов
  it('генерируем шаблон программы Благорост', async () => {
    await testDocumentGeneration({
      registry_id: 998,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })
  it('генерируем шаблон оферты Благорост', async () => {
    await testDocumentGeneration({
      registry_id: 999,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  // Документы благороста и генерации
  it('генерируем оферту Благорост', async () => {
    await testDocumentGeneration({
      registry_id: 1000,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем соглашение о генерации', async () => {
    await testDocumentGeneration({
      registry_id: 1001,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем приложение к соглашению о генерации для проекта (1002)', async () => {
    await testDocumentGeneration({
      registry_id: 1002,
      coopname: 'voskhod',
      username: 'ant',
      appendix_hash: 'A001ZSA1',
      project_name: 'Проект цифровой платформы',
      project_hash: 'B2C3D4E5F6789ABC',
      lang: 'ru',
    })
  })

  it('генерируем дополнение к приложению для компонента (1003)', async () => {
    await testDocumentGeneration({
      registry_id: 1003,
      coopname: 'voskhod',
      username: 'ant',
      appendix_hash: 'A002ZSA2',
      parent_appendix_hash: 'A001ZSA1',
      component_name: 'Компонент разработки',
      component_hash: 'A1B2C3D4E5F6789A',
      project_name: 'Проект цифровой платформы',
      project_hash: 'B2C3D4E5F6789ABC',
      lang: 'ru',
    })
  })

  it('генерируем дополнительные условия по ответственному хранению имущества (1004)', async () => {
    await testDocumentGeneration({
      registry_id: 1004,
      coopname: 'voskhod',
      username: 'ant',
      storage_agreement_hash: 'SA001ABC123',
      lang: 'ru',
    })
  })

  it('генерируем соглашение о присоединении к целевой потребительской программе «БЛАГОРОСТ» (1007)', async () => {
    await testDocumentGeneration({
      registry_id: 1007,
      coopname: 'voskhod',
      username: 'ant',
      blagorost_agreement_hash: 'BA001DEF456',
      contributor_hash: 'ED3BCFC5B681AA83D123456789ABCDEF',
      contributor_contract_created_at: '11.04.2024',
      lang: 'ru',
    })
  })

  it('генерируем заявление на инициализацию проекта', async () => {
    await testDocumentGeneration({
      registry_id: 1005,
      coopname: 'voskhod',
      username: 'ant',
      project_name: 'Проект цифровой платформы',
      project_hash: 'B2C3D4E5F6789ABC',
      component_name: 'Компонент разработки',
      component_hash: 'A1B2C3D4E5F6789A',
      is_component: true,
      lang: 'ru',
    })
  })

  it('генерируем решение об инициализации проекта', async () => {
    await testDocumentGeneration({
      registry_id: 1006,
      coopname: 'voskhod',
      username: 'ant',
      decision_id: 1,
      project_name: 'Проект цифровой платформы',
      project_hash: 'B2C3D4E5F6789ABC',
      component_name: 'Компонент разработки',
      component_hash: 'A1B2C3D4E5F6789A',
      is_component: true,
      lang: 'ru',
    })
  })

  // Документы расходов
  it('генерируем заявление о расходах', async () => {
    await testDocumentGeneration({
      registry_id: 1010,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем решение о расходах', async () => {
    await testDocumentGeneration({
      registry_id: 1011,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  // Шасси расходов (волна 6, MVP-SINGLE) — C28-30
  it('генерируем СЗ-смету о расходах 2010 (шасси, массив items)', async () => {
    await testDocumentGeneration({
      registry_id: 2010,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      proposal: {
        description: 'Закупка хостинга и бухгалтерских услуг на июнь 2026',
        total_amount: '15000.00 RUB',
        items_count: 2,
        source_wallet: 'w.cap.bla',
      },
      items: [
        {
          number: '1',
          description: 'Аренда серверов Yandex Cloud (тариф S, июнь)',
          amount: '12000.00 RUB',
          recipient_type: 'ORG',
          mechanics: 'DIRECT',
          recipient_name: 'ООО «Яндекс.Облако»',
          requisites: 'ИНН 7704414297, р/с 40702810000000000000, БИК 044525000',
        },
        {
          number: '2',
          description: 'Канцелярия для офиса',
          amount: '3000.00 RUB',
          recipient_type: 'SELF',
          mechanics: 'ADVANCE',
        },
      ],
    })
  })

  it('генерируем протокол-1 утверждения СЗ 2011 (шасси, approve)', async () => {
    await testDocumentGeneration({
      registry_id: 2011,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      proposal_hash: '0xabc123def4560000000000000000000000000000000000000000000000000000',
      proposal: {
        description: 'Закупка хостинга и бухгалтерских услуг на июнь 2026',
        total_amount: '15000.00 RUB',
        items_count: 2,
        source_wallet: 'w.cap.bla',
      },
      items: [
        { number: '1', description: 'Аренда серверов Yandex Cloud', amount: '12000.00 RUB', recipient_type: 'ORG', mechanics: 'DIRECT' },
        { number: '2', description: 'Канцелярия для офиса', amount: '3000.00 RUB', recipient_type: 'SELF', mechanics: 'ADVANCE' },
      ],
      decision: {
        kind: 'approve',
        protocol_number: '15',
        protocol_date: '03.06.2026',
      },
    })
  })

  it('генерируем протокол-1 ОТКАЗА по СЗ 2011 (шасси, decline + reason)', async () => {
    await testDocumentGeneration({
      registry_id: 2011,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      proposal_hash: '0xfedcba9876540000000000000000000000000000000000000000000000000000',
      proposal: {
        description: 'Закупка хостинга и бухгалтерских услуг на июнь 2026',
        total_amount: '15000.00 RUB',
        items_count: 2,
        source_wallet: 'w.cap.bla',
      },
      items: [
        { number: '1', description: 'Аренда серверов Yandex Cloud', amount: '12000.00 RUB', recipient_type: 'ORG', mechanics: 'DIRECT' },
        { number: '2', description: 'Канцелярия для офиса', amount: '3000.00 RUB', recipient_type: 'SELF', mechanics: 'ADVANCE' },
      ],
      decision: {
        kind: 'decline',
        reason: 'Просьба разделить позиции на отдельные СЗ — Yandex Cloud и канцелярия имеют разный контур контроля.',
        protocol_number: '16',
        protocol_date: '03.06.2026',
      },
    })
  })

  // Документы инвестиций в генерацию
  it('генерируем заявление об инвестициях денег в генерацию', async () => {
    await testDocumentGeneration({
      registry_id: 1020,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      appendix_hash: 'A001INV1',
      appendix_created_at: '12.01.2026',
      project_hash: 'PRJ20260115001',
      amount: '50000.00 RUB',
    })
  })

  it('генерируем заявление о возврате неиспользованных денег генерации', async () => {
    await testDocumentGeneration({
      registry_id: 1025,
      coopname: 'voskhod',
      username: 'ant',
      project_hash: 'B2C3D4E5F6789ABC',
      amount: '5000.00 RUB',
      lang: 'ru',
    })
  })

  // Документы инвестиций в благорост
  it('генерируем заявление об инвестициях денег в благорост', async () => {
    await testDocumentGeneration({
      registry_id: 1030,
      coopname: 'voskhod',
      username: 'ant',
      amount: '50000.00 RUB',
      lang: 'ru',
    })
  })

  // Документы взносов результатов
  it('генерируем заявление о взносе результатов', async () => {
    await testDocumentGeneration({
      registry_id: 1040,
      coopname: 'voskhod',
      username: 'ant',
      project_name: 'Проект цифровой платформы',
      component_name: 'Компонент разработки',
      result_hash: 'a3b64ceaa3c5ba840eb34f5f603bd03de6b431c2c2f2244ea83a373b2cde01c2c2f2244ea83a373b2cde01c2c2f2244ea83a373b2cde0',
      percent_of_result: '25.00000000',
      total_amount: '50000.00 RUB',
      lang: 'ru',
    })
  })

  it('генерируем решение о взносе результатов', async () => {
    await testDocumentGeneration({
      registry_id: 1041,
      coopname: 'voskhod',
      username: 'ant',
      decision_id: 1,
      project_name: 'Проект цифровой платформы',
      component_name: 'Компонент разработки',
      result_hash: 'a3b64ceaa3c5ba840eb34f5f603bd03de6b431c2c2f2244ea83a373b2cde01c2c2f2244ea83a373b2cde01c2c2f2244ea83a373b2cde0',
      percent_of_result: '25.00000000',
      total_amount: '50000.00 RUB',
      lang: 'ru',
    })
  })

  it('генерируем акт о взносе результатов', async () => {
    await testDocumentGeneration({
      registry_id: 1042,
      coopname: 'voskhod',
      username: 'ant',
      result_act_hash: 'ACT1234567890ABCDEF',
      result_hash: 'a3b64ceaa3c5ba840eb34f5f603bd03de6b431c2c2f2244ea83a373b2cde01c2c2f2244ea83a373b2cde01c2c2f2244ea83a373b2cde0',
      percent_of_result: '25.00000000',
      total_amount: '50000.00 RUB',
      decision_id: 1,
      lang: 'ru',
    })
  })

  // Документы получения займов
  it('генерируем заявление о получении займа', async () => {
    await testDocumentGeneration({
      registry_id: 1050,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем решение о получении займа', async () => {
    await testDocumentGeneration({
      registry_id: 1051,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  // Документы инвестиций имущества в генерацию
  it('генерируем заявление об инвестициях имущества в генерацию', async () => {
    await testDocumentGeneration({
      registry_id: 1060,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем решение об инвестициях имущества в генерацию', async () => {
    await testDocumentGeneration({
      registry_id: 1061,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем акт об инвестициях имущества в генерацию', async () => {
    await testDocumentGeneration({
      registry_id: 1062,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  // Документы инвестиций имущества в благорост
  it('генерируем заявление об инвестициях имущества в благорост', async () => {
    await testDocumentGeneration({
      registry_id: 1070,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем решение об инвестициях имущества в благорост', async () => {
    await testDocumentGeneration({
      registry_id: 1071,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем акт об инвестициях имущества в благорост', async () => {
    await testDocumentGeneration({
      registry_id: 1072,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  // Документы конвертации
  it('генерируем заявление о переводе части целевого паевого взноса', async () => {
    await testDocumentGeneration({
      registry_id: 1080,
      coopname: 'voskhod',
      username: 'ant',
      appendix_hash: 'APP1234567890ABCDEF',
      project_hash: 'PRJ1234567890ABCDEF',
      main_wallet_amount: '15000.00 RUB',
      blagorost_wallet_amount: '25000.00 RUB',
      to_wallet: true,
      to_blagorost: true,
      lang: 'ru',
    })
  })

  it('генерируем заявление о конвертации генерации в проект', async () => {
    await testDocumentGeneration({
      registry_id: 1081,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем заявление о конвертации генерации в благорост', async () => {
    await testDocumentGeneration({
      registry_id: 1082,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })

  it('генерируем заявление о конвертации благороста в основной кошелёк', async () => {
    await testDocumentGeneration({
      registry_id: 1090,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
    })
  })
})
