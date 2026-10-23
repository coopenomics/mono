import { beforeAll, describe, expect, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Акт передачи материалов занятия на ответственное хранение (3012) — приложение
 * к договору УХД преподавателя. Проверяется, что акт называет договор, занятие
 * и его материалы, срок хранения и порядок, которым Имущество становится
 * паевым взносом.
 */
function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const BASE = {
  registry_id: 3012,
  coopname: 'voskhod',
  username: 'ant',
  lang: 'ru',
  rid_hash: '55c470039a8c53ce1b4b6e842fe8063ab3d5b85ba2ba8ab0ae6e30be3ad328b7',
  amount: '1500.0000 RUB',
  rid_type: 'lesson_recording',
  course_title: 'Математика, 7 класс',
  lesson_number: 3,
  lesson_topic: 'Линейные уравнения',
  held_at: '12.06.2026 10:00',
  duration_minutes: 45,
  materials: ['https://cloud.example/lesson-3.mp4', 'https://cloud.example/lesson-3.pdf'],
  hold_until: '26.06.2026',
}

async function generate(data: Record<string, unknown> = {}): Promise<IGeneratedDocument> {
  return generator.generate({ ...BASE, ...data } as never)
}

describe('Акт передачи материалов занятия на ответственное хранение', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
    for (const [key, value] of [
      [Cooperative.Model.UdataKey.EDUCATION_CONTRACT_NUMBER, 'УХД-0007'],
      [Cooperative.Model.UdataKey.EDUCATION_CONTRACT_CREATED_AT, '15.09.2026'],
    ] as const) {
      await generator.save('udata', { coopname: 'voskhod', username: 'ant', key, value })
    }
  })

  it('генерируется и воспроизводится с тем же хэшем', async () => {
    await testDocumentGeneration(BASE as never)
  })

  it('называет занятие, его длительность и состав материалов', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('Математика, 7 класс')
    expect(text).toContain('№ 3, Линейные уравнения')
    expect(text).toContain('12.06.2026 10:00, 45 минут')
    expect(text).toContain('https://cloud.example/lesson-3.mp4')
    expect(text).toContain('https://cloud.example/lesson-3.pdf')
  })

  it('оформлен приложением к договору УХД и называет его номер и дату', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('к ДОГОВОРУ об участии в хозяйственной деятельности № УХД-0007')
    expect(text).toContain('АКТ № АППИОХ-')
    expect(text).toContain('согласно Договора об участии в хозяйственной деятельности № УХД-0007 от 15.09.2026')
    expect(text).not.toContain('Целевой Потребительской Программе')
  })

  it('называет вид результата словами, срок хранения и оценку', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('Запись занятия')
    expect(text).not.toContain('lesson_recording')
    expect(text).toContain('до 26.06.2026 включительно')
    expect(text).toContain('1500.00 RUB')
  })

  it('оговаривает, что паевым взносом Имущество становится по заявлению и решению совета', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('Пайщик направляет в Общество заявление на внесение Паевого взноса Имуществом')
    expect(text).toContain('решением Совета Общества и Актом приема-передачи Имущества')
    expect(text).toContain('При наступлении Гарантийного случая')
  })

  it('подписывает документ преподаватель — строка приёма Обществом в акте одна', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('ПЕРЕДАНО')
    expect(text).not.toContain('ПОЛУЧЕНО')
  })
})
