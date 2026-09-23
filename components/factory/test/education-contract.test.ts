import { beforeAll, describe, expect, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Договор УХД преподавателя по ЦПП «Образование». Совет утверждает его в бланке
 * (двойник 3005 выведен), пайщик подписывает тот же шаблон со своими данными:
 * текст договора в бланке и в экземпляре обязан совпадать дословно.
 */
const CONTRACT = Cooperative.Registry.EducationParticipationContract.registry_id
const CONTRACT_NUMBER = 'УХД-0007'
const CONTRACT_DATE = '15.09.2026'
const PROTOCOL = { protocol_number: 'СС-01-09-26', protocol_day_month_year: '01 сентября 2026 г.' }

function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Разделы 1–9 и пункты Дополнительных условий — то, что обязано совпасть. */
function contractBody(html: string): string {
  const text = plainText(html)
  const body = text.slice(text.indexOf('1. Термины и определения'), text.indexOf('10. Реквизиты и подписи Сторон'))
  const terms = text.slice(text.indexOf('1. Настоящие Дополнительные Условия используют'), text.lastIndexOf('Общество /'))
  return `${body}\n${terms}`
}

async function generate(registry_id: number): Promise<IGeneratedDocument> {
  return generator.generate({ registry_id, coopname: 'voskhod', username: 'ant', lang: 'ru' })
}

/** Бланк договора — то, что видит и утверждает совет. */
async function blank(): Promise<{ html: string }> {
  return generator.generateBlank({ registry_id: CONTRACT, coopname: 'voskhod' })
}

describe('договор УХД преподавателя по ЦПП «Образование»', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
    await generator.update('vars', { coopname: 'voskhod' }, { education_contract_template: PROTOCOL })
    for (const [key, value] of [
      [Cooperative.Model.UdataKey.EDUCATION_CONTRACT_NUMBER, CONTRACT_NUMBER],
      [Cooperative.Model.UdataKey.EDUCATION_CONTRACT_CREATED_AT, CONTRACT_DATE],
    ] as const) {
      await generator.save('udata', { coopname: 'voskhod', username: 'ant', key, value })
    }
  })

  it('экземпляр договора генерируется и воспроизводится с тем же хэшем', async () => {
    await testDocumentGeneration({ registry_id: CONTRACT, coopname: 'voskhod', username: 'ant', lang: 'ru' })
  })

  it('текст договора в бланке и экземпляре совпадает дословно', async () => {
    const template = contractBody((await blank()).html)
    const instance = contractBody((await generate(CONTRACT)).html)
    expect(template.length).toBeGreaterThan(20000)
    expect(instance).toEqual(template)
  })

  it('договор содержит все 9 разделов, 12 терминов и 12 пунктов Дополнительных условий', async () => {
    const text = plainText((await generate(CONTRACT)).html)
    for (const title of [
      '1. Термины и определения',
      '2. Предмет Договора',
      '3. Порядок приема-передачи Имущества',
      '4. Порядок возврата Имущества в соответствии с Гарантийными условиями',
      '5. Порядок и условия возврата Паевых взносов',
      '6. Ответственность Сторон',
      '7. Права и обязанности Сторон',
      '8. Форс-мажорные обстоятельства',
      '9. Заключительные положения',
      '10. Реквизиты и подписи Сторон',
      'Дополнительные условия по ответственному хранению Имущества с правом пользования',
    ]) {
      expect(text).toContain(title)
    }
    expect(text).toContain('1.12. Гарантийные условия —')
    expect(text).toContain('9.9. Все разногласия стороны решают путем переговоров.')
    expect(text).toContain('12. Настоящие Дополнительные Условия вступают в силу')
  })

  it('экземпляр подставляет номер, дату, протокол утверждения и пайщика; незаполненных мест нет', async () => {
    const text = plainText((await generate(CONTRACT)).html)
    expect(text).toContain(`об участии в хозяйственной деятельности № ${CONTRACT_NUMBER}`)
    expect(text).toContain(`Протокол № ${PROTOCOL.protocol_number} от ${PROTOCOL.protocol_day_month_year}`)
    expect(text).toContain(`Договора об участии в хозяйственной деятельности № ${CONTRACT_NUMBER} от ${CONTRACT_DATE}`)
    expect(text).toContain('Подписано электронной подписью.')
    expect(text).not.toMatch(/undefined|null|______|\[ФИО\]|\{%|\{\{/)
  })

  it('бланк не содержит данных пайщика: номер, дата и пайщик — прочерками', async () => {
    const text = plainText((await blank()).html)
    expect(text).toContain('______')
    expect(text).not.toContain(CONTRACT_NUMBER)
    expect(text).not.toContain(CONTRACT_DATE)
    expect(text).not.toMatch(/undefined|null|\{%|\{\{/)
  })
})
