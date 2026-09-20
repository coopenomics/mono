import { beforeAll, describe, expect, it } from 'vitest'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Акт передачи материалов занятия на ответственное хранение (3012). Проверяется,
 * что в акте видно занятие и его материалы, назван срок хранения и сказано, что
 * паевым взносом материалы становятся позже — по заявлению и решению совета.
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
  rid_type: 'lesson',
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

  it('называет срок хранения и оценку материалов', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('принимает материалы на ответственное хранение до 26.06.2026 включительно')
    expect(text).toContain('1500.00 RUB')
  })

  it('оговаривает, что паевым взносом материалы становятся по решению совета', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('Право собственности на материалы сохраняется за Преподавателем')
    expect(text).toContain('по заявлению Преподавателя и решению Совета')
    expect(text).toContain('Гарантийный случай, подтверждённый в течение срока хранения, прекращает хранение')
  })

  it('подписывает документ преподаватель — строка приёма Обществом в акте одна', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('ПЕРЕДАЛ')
    expect(text).not.toContain('ПРИНЯЛ')
  })
})
