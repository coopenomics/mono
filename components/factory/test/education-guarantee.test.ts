import { beforeAll, describe, expect, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Документы аннулирования Подписки по Гарантийным условиям ЦПП «Образование» —
 * заявление пайщика-ученика (3013) и протокол совета (3014): ссылаются на
 * пункты 4.4.2 и 4.4.4 Положения, называют Подписку и её стоимость, номер
 * заявления — короткий.
 */
const R = Cooperative.Registry
const CLAIM = '55c470039a8c53ce1b4b6e842fe8063ab3d5b85ba2ba8ab0ae6e30be3ad328b7'
const BASE = { coopname: 'voskhod', username: 'ant', lang: 'ru' }
const PROTOCOL = { protocol_number: 'СС-01-09-26', protocol_day_month_year: '01 сентября 2026 г.' }
const LINK = 'https://cloud.example/claim-proof.pdf'

function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function text(data: Record<string, unknown>): Promise<string> {
  return plainText((await generator.generate({ ...BASE, ...data } as never)).html)
}

const STATEMENT = {
  registry_id: R.EducationGuaranteeStatement.registry_id,
  claim_hash: CLAIM,
  course_title: 'Основы программирования',
  subscribed_at: '01.10.2026',
  amount: '1000.0000 RUB',
  guarantee_until: '15.10.2026',
  reason: 'Содержание занятий не соответствует заявленной программе курса.',
  links: [LINK],
}
const STATEMENT_NO_LINKS = { ...STATEMENT, links: [] as string[] }
const DECISION = {
  registry_id: R.EducationGuaranteeDecision.registry_id,
  decision_id: 1,
  claim_hash: CLAIM,
  course_title: 'Основы программирования',
  amount: '1000.0000 RUB',
}

describe('документы аннулирования Подписки по Гарантийным условиям', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
    await generator.update('vars', { coopname: 'voskhod' }, { education_provision: PROTOCOL })
  })

  for (const [name, doc] of [['со ссылками', STATEMENT], ['без ссылок', STATEMENT_NO_LINKS]] as const) {
    it(`заявление ${doc.registry_id} ${name} генерируется и воспроизводится с тем же хэшем`, async () => {
      await testDocumentGeneration({ ...BASE, ...doc } as never)
    })
  }

  it('заявление ссылается на Положение, называет Подписку, причину и просит возврат на баланс ЦК', async () => {
    const t = await text(STATEMENT)
    expect(t).toContain('ЗАЯВЛЕНИЕ № ЗАП-55C47003')
    expect(t).toContain('об аннулировании Подписки по Гарантийным условиям')
    expect(t).toContain('В соответствии с пунктом 4.4.2 Положения о целевой потребительской программе «ОБРАЗОВАНИЕ», утверждённого решением Совета Общества (протокол от 01 сентября 2026 г. № СС-01-09-26) (далее — Положение), прошу аннулировать Подписку:')
    expect(t).toContain('Наименование Подписки Основы программирования')
    expect(t).toContain('Дата подключения Подписки 01.10.2026')
    expect(t).toContain('Стоимость Подписки, списанная в соответствии с пунктом 4.2.2 Положения 1000.00 RUB')
    expect(t).toContain('Срок действия Гарантийных условий до 15.10.2026')
    expect(t).toContain('Причина аннулирования Подписки: Содержание занятий не соответствует заявленной программе курса.')
    expect(t).toContain('Материалы, подтверждающие причину:')
    expect(t).toContain(LINK)
    expect(t).toContain('Прошу возвратить стоимость Подписки на баланс моего ЦК в соответствии с пунктом 4.4.4 Положения.')
    expect(t).toContain('Подписано электронной подписью.')
    expect(t).not.toContain('«ПРИНЯТО»')
    expect(t).not.toContain('Приложение №')
  })

  it('заявление без ссылок блок подтверждающих материалов не выводит', async () => {
    const t = await text(STATEMENT_NO_LINKS)
    expect(t).not.toContain('Материалы, подтверждающие причину:')
    expect(t).toContain('Причина аннулирования Подписки:')
    expect(t).toContain('Прошу возвратить стоимость Подписки на баланс моего ЦК')
  })

  it('протокол слушает председателя, удовлетворяет заявление и возвращает стоимость Подписки', async () => {
    const t = await text(DECISION)
    expect(t).toContain('ПРОТОКОЛ №')
    expect(t).toContain('№ ЗАП-55C47003 об аннулировании Подписки «Основы программирования» по Гарантийным условиям в соответствии с пунктом 4.4.2 Положения о целевой потребительской программе «ОБРАЗОВАНИЕ».')
    expect(t).toContain('СЛУШАЛИ')
    expect(t).toContain('с предложением удовлетворить заявление пайщика')
    expect(t).toContain('1. Удовлетворить заявление пайщика')
    expect(t).toContain('аннулировать Подписку «Основы программирования» и возвратить на баланс ЦК пайщика списанную стоимость Подписки в размере 1000.00 RUB в соответствии с пунктом 4.4.4 Положения о целевой потребительской программе «ОБРАЗОВАНИЕ».')
    expect(t).not.toContain('ИТОГО')
  })

  it('суммы отформатированы, служебных значений в документах нет', async () => {
    for (const doc of [STATEMENT, STATEMENT_NO_LINKS, DECISION]) {
      const t = await text(doc)
      expect(t).toContain('1000.00 RUB')
      expect(t).not.toContain('.0000')
      expect(t).not.toContain(CLAIM)
      expect(t).not.toMatch(/undefined|\{%|\{\{/)
    }
  })
})
