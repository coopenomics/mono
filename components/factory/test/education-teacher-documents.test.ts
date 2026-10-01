import { beforeAll, describe, expect, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Документы преподавателя по договору УХД ЦПП «Образование» — заявление
 * (3008), протокол (3009) и акт приёма-передачи (3010) — оформлены
 * приложениями к договору по формам «Благороста» (1040–1042): называют номер
 * и дату договора, вид результата — словами.
 */
const R = Cooperative.Registry
const RID = '55c470039a8c53ce1b4b6e842fe8063ab3d5b85ba2ba8ab0ae6e30be3ad328b7'
const BASE = { coopname: 'voskhod', username: 'ant', lang: 'ru' }
const CONTRACT = 'Договора об участии в хозяйственной деятельности № УХД-0007 от 15.09.2026'

function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function text(data: Record<string, unknown>): Promise<string> {
  return plainText((await generator.generate({ ...BASE, ...data } as never)).html)
}

const STATEMENT = { registry_id: R.EducationRidStatement.registry_id, rid_hash: RID, assignment_id: 12, amount: '1500.0000 RUB', rid_type: 'lesson_recording', links: ['https://cloud.example/lesson-3.mp4'] }
const DECISION = { registry_id: R.EducationRidDecision.registry_id, decision_id: 1, rid_hash: RID, rid_type: 'lesson_recording', amount: '1500.0000 RUB' }
const ACT = { registry_id: R.EducationRidAct.registry_id, rid_hash: RID, amount: '1500.0000 RUB', rid_type: 'lesson_recording', decision_id: 17, decision_date: '20.09.2026' }

describe('документы преподавателя по договору УХД', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
    for (const [key, value] of [
      [Cooperative.Model.UdataKey.EDUCATION_CONTRACT_NUMBER, 'УХД-0007'],
      [Cooperative.Model.UdataKey.EDUCATION_CONTRACT_CREATED_AT, '15.09.2026'],
    ] as const) {
      await generator.save('udata', { coopname: 'voskhod', username: 'ant', key, value })
    }
  })

  for (const doc of [STATEMENT, ACT]) {
    it(`документ ${doc.registry_id} генерируется и воспроизводится с тем же хэшем`, async () => {
      await testDocumentGeneration({ ...BASE, ...doc } as never)
    })
  }

  it('заявление ссылается на договор, описывает Имущество и несёт заверение о праве собственности', async () => {
    const t = await text(STATEMENT)
    expect(t).toContain('ЗАЯВЛЕНИЕ № ЗПВИ-')
    expect(t).toContain(`В соответствии с условиями ${CONTRACT}, прошу принять от меня Паевой взнос`)
    expect(t).toContain('Запись занятия (задание № 12)')
    expect(t).toContain('https://cloud.example/lesson-3.mp4')
    expect(t).toContain('принадлежит мне на праве собственности, в споре и под арестом не состоит')
    expect(t).toContain('«ПРИНЯТО»')
    expect(t).toContain('1500.00 RUB')
  })

  it('протокол слушает председателя и принимает взнос по заявлению и договору', async () => {
    const t = await text(DECISION)
    expect(t).toContain('СЛУШАЛИ')
    expect(t).toContain(`в соответствии с условиями ${CONTRACT}`)
    expect(t).toContain('1. Принять паевой взнос Имуществом от пайщика')
    expect(t).toContain('Запись занятия')
  })

  it('акт называет договор и протокол совета, подписывают обе стороны', async () => {
    const t = await text(ACT)
    expect(t).toContain('АКТ № АППИ-')
    expect(t).toContain(`в соответствии с условиями ${CONTRACT} и Протоколом Совета № 17 от 20.09.2026 следующее Имущество`)
    expect(t).toContain('Претензий по качеству Имущества Общество не имеет.')
    expect(t).toContain('ПЕРЕДАНО:')
    expect(t).toContain('ПОЛУЧЕНО:')
  })

  it('допуск к курсу документа не имеет — приложения на курс в реестре нет', () => {
    expect((R as Record<string, unknown>).EducationCourseAnnex).toBeUndefined()
    expect(Object.values(R).some((doc: any) => doc?.registry_id === 3007)).toBe(false)
  })

  it('служебных значений и ссылки на ЦПП в документах преподавателя нет', async () => {
    for (const doc of [STATEMENT, DECISION, ACT]) {
      const t = await text(doc)
      expect(t).not.toContain('lesson_recording')
      expect(t).not.toContain('Целевой Потребительской Программе')
      expect(t).not.toMatch(/undefined|\{%|\{\{/)
    }
  })
})
