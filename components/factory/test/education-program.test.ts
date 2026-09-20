import { beforeAll, describe, expect, it } from 'vitest'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Положение о ЦПП «Образование» (3000) — текст, утверждённый кооперативом.
 * Проверяется, что в шаблоне стоит именно он: разделы на месте, ключевые
 * условия подписки, отмен и возвратов читаются дословно, а наименование
 * Общества и председатель подставляются.
 */
function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function generate(): Promise<IGeneratedDocument> {
  return generator.generate({ registry_id: 3000, coopname: 'voskhod', username: 'ant', lang: 'ru' })
}

describe('Положение о ЦПП «Образование»', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
  })

  it('генерируется и воспроизводится с тем же хэшем', async () => {
    await testDocumentGeneration({ registry_id: 3000, coopname: 'voskhod', username: 'ant', lang: 'ru' })
  })

  it('уведомляет участников о форс-мажоре и изменениях условий (п. 6.5 редакции 19.09.2026)', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('При наступлении форс-мажорных обстоятельств или внесении изменений в условия ЦПП')
    expect(text).toContain('Общество незамедлительно уведомляет о них Участников ЦПП')
  })

  it('содержит все шесть разделов утверждённого текста', async () => {
    const text = plainText((await generate()).html)
    for (const title of [
      '1. Термины ЦПП',
      '2. Цели',
      '3. Порядок принятия пайщика в Участники ЦПП',
      '4. Хозяйственный механизм ЦПП, права и обязанности Участников, вытекающие из его условий',
      '5. Права и Обязанности',
      '6. Форс-мажорные обстоятельства',
    ]) {
      expect(text).toContain(title)
    }
  })

  it('условия подписки, отмен и возвратов перенесены дословно', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain(
      'стоимость Подписки направляется с баланса ЦК Участника на баланс Кошелька ЦПП Участника с одновременной конвертацией в Членский взнос и списывается в распоряжение Общества по реализации ЦПП.'
    )
    expect(text).toContain(
      'Общество оставляет за собой право отмены Подписки до даты ее активации, указанной в карточке Подписки на виртуальном каталоге Сайта'
    )
    expect(text).toContain('Участник имеет право самостоятельно отменить подключение к Подписке до наступления даты ее активации')
    expect(text).toContain(
      'Общество возвращает на баланс Кошелька ЦПП Участника 50% от остаточной стоимости Подписки за вычетом стоимости фактически использованного срока Подписки.'
    )
    expect(text).toContain(
      'Гарантийные условия - добровольное обязательство Общества, обусловленное, прежде всего, временным периодом, в течение которого Участник получает возможность определиться в полноте удовлетворения собственных потребностей в рамках ЦПП.'
    )
  })

  it('подставляет наименование Общества и председателя, прежней рыбы не осталось', async () => {
    const text = plainText((await generate()).html)
    expect(text).toMatch(/Потребительского Кооператива «[^»]+»/)
    expect(text).toContain('Председатель Совета')
    expect(text).toContain('Подписано электронной подписью.')
    // Рыба называла членский взнос невозвратным и не знала ни Подписки, ни Кошелька ЦПП.
    expect(text).not.toContain('Задачей ЦПП является организация курсов силами Преподавателей')
    expect(text).not.toMatch(/undefined|null|\{%|\{\{/)
  })
})
