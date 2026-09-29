import { beforeAll, describe, expect, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Оферты ученика (3002) и преподавателя (3004) по ЦПП «Образование» строятся
 * из Положения о ЦПП (3000), как оферты «Благороста»: условия Положения
 * изложены условиями соглашения, раздел о приёме в Участники в оферту не
 * входит, разделы после него сдвинуты на номер.
 */
const R = Cooperative.Registry
const PROTOCOL = { protocol_number: 'СС-01-09-26', protocol_day_month_year: '01 сентября 2026 г.' }
const OFFER_PROTOCOL = { protocol_number: 'СС-02-09-26', protocol_day_month_year: '02 сентября 2026 г.' }
const OFFERS = [
  { registry_id: R.EducationParentOffer.registry_id, agreement_number: 'ОБР-У-0001' },
  { registry_id: R.EducationTeacherOffer.registry_id, agreement_number: 'ОБР-П-0001' },
]

function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function generate(offer: typeof OFFERS[number]): Promise<IGeneratedDocument> {
  return generator.generate({ ...offer, agreement_created_at: '29.09.2026', coopname: 'voskhod', username: 'ant', lang: 'ru' } as never)
}

describe('оферты ЦПП «Образование»', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
    await generator.update('vars', { coopname: 'voskhod' }, {
      education_provision: PROTOCOL,
      education_parent_offer_template: OFFER_PROTOCOL,
      education_teacher_offer_template: OFFER_PROTOCOL,
    })
  })

  for (const offer of OFFERS) {
    describe(`оферта ${offer.registry_id}`, () => {
      it('генерируется и воспроизводится с тем же хэшем', async () => {
        await testDocumentGeneration({ ...offer, agreement_created_at: '29.09.2026', coopname: 'voskhod', username: 'ant', lang: 'ru' } as never)
      })

      it('несёт шапку утверждения, основание — Положение с его протоколом — и акцепт', async () => {
        const text = plainText((await generate(offer)).html)
        expect(text).toContain('УТВЕРЖДЕНО: Протоколом Совета № СС-02-09-26')
        expect(text).toContain(`ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ (ОФЕРТА) № ${offer.agreement_number}`)
        expect(text).toContain('на основании Положения Общества о целевой потребительской программе «ОБРАЗОВАНИЕ», утвержденного Собранием Совета Общества (Протокол № СС-01-09-26 от 01 сентября 2026 г.)')
        expect(text).toContain('считается датой акцепта')
      })

      it('излагает условия Положения условиями соглашения', async () => {
        const text = plainText((await generate(offer)).html)
        expect(text).not.toMatch(/настоящ(его|им|ем|ее) Положени/)
        expect(text).not.toContain('настоящего Договора')
        expect(text).toContain('Общество возвращает на баланс Кошелька ЦПП Участника 50% от остаточной стоимости Подписки')
      })

      it('разделы после приёма в Участники сдвинуты на номер вместе со ссылками', async () => {
        const text = plainText((await generate(offer)).html)
        for (const title of [
          '1. Термины ЦПП',
          '2. Цели',
          '3. Хозяйственный механизм ЦПП',
          '4. Права и Обязанности',
          '5. Форс-мажорные обстоятельства',
          '6. Прочие условия',
        ]) {
          expect(text).toContain(title)
        }
        expect(text).not.toContain('Порядок принятия пайщика в Участники ЦПП')
        expect(text).toContain('3.2.4. В случае отмены Обществом Подписки в соответствии с п. 3.2.3. настоящего Пользовательского соглашения')
        expect(text).toContain('в соответствии с п. 5.1 настоящего Пользовательского соглашения')
        expect(text).not.toMatch(/undefined|null|\{%|\{\{/)
      })
    })
  }

  it('оферта ученика берёт согласие на передачу почты обучающегося', async () => {
    const text = plainText((await generate(OFFERS[0]!)).html)
    expect(text).toContain('дает согласие на передачу адреса электронной почты')
  })

  it('оферта преподавателя отсылает поставку Имущества к договору УХД', async () => {
    const text = plainText((await generate(OFFERS[1]!)).html)
    expect(text).toContain('на основании отдельного Договора об участии в хозяйственной деятельности с Обществом и настоящим Пользовательским соглашением не регулируются')
    expect(text).not.toContain('Преподаватель не является Участником ЦПП')
  })
})
