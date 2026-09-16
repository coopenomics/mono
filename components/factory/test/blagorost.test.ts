import { beforeAll, describe, expect, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { Generator } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'
import { capitalProgramPrivateData } from './utils/capitalProgramPrivateData'

let capitalProgramDocDataHash = ''

describe('тест генератора документов ЦПП БЛАГОРОСТ', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)

    // Документы 998-1000 требуют приватные данные программы через
    // doc_data_hash (cooptypes: requireCapitalProgramPrivateData). Без него
    // генерация падает с «PrivateData для документа #N не найдены».
    const { hash } = await generator.saveDocData(capitalProgramPrivateData, 998)
    capitalProgramDocDataHash = hash

    const udataRecords = [
      { key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER, value: 'БЛ-001/2024' },
      { key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT, value: '2024-06-15T10:00:00.000Z' },
    ]

    for (const rec of udataRecords) {
      await generator.save('udata', {
        coopname: 'voskhod',
        username: 'ant',
        ...rec,
      })
    }
  })

  // Документ 998 - Положение о ЦПП БЛАГОРОСТ
  it('генерируем Положение о ЦПП БЛАГОРОСТ', async () => {
    await testDocumentGeneration({
      registry_id: 998,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      doc_data_hash: capitalProgramDocDataHash,
    })
  })

  // Бланк оферты 1000 для совета: двойник 999 выведен. Тот же шаблон и
  // переводы, параметры программы по хэшу подставлены, поля пайщика — прочерк.
  it('собираем бланк публичной оферты по ЦПП БЛАГОРОСТ с параметрами программы', async () => {
    const blank = await generator.generateBlank({
      registry_id: 1000,
      coopname: 'voskhod',
      doc_data_hash: capitalProgramDocDataHash,
    })
    expect(blank.html).toContain('______')
    expect(blank.meta.created_at).toBe('______')
    const param = Object.values(capitalProgramPrivateData).find(v => typeof v === 'string' && v.length > 8) as string
    expect(blank.html).toContain(param)
  })

  // Документ 1000 - Публичная оферта для пайщика (с шапкой)
  it('генерируем публичную оферту для пайщика по ЦПП БЛАГОРОСТ', async () => {
    // Добавляем данные протокола для документа 999
    await generator.update('vars', { coopname: 'voskhod' }, {
      blagorost_offer_template: {
        protocol_number: '15-12-2024',
        protocol_day_month_year: '15 декабря 2024 г.',
      },
    })

    await testDocumentGeneration({
      registry_id: 1000,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      doc_data_hash: capitalProgramDocDataHash,
    })
  })
})
