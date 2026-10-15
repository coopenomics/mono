import { beforeAll, describe, expect, it } from 'vitest'
import { Cooperative } from 'cooptypes'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Заявление преподавателя о трансляции паевого взноса из ЦПП «Образование» в
 * ЦПП «Цифровой Кошелёк» (3015): одна просьба с суммой, без ссылок на договор
 * и без приложений.
 */
const R = Cooperative.Registry
const BASE = { coopname: 'voskhod', username: 'ant', lang: 'ru' }
const STATEMENT = { registry_id: R.EducationShareWithdrawStatement.registry_id, amount: '1500.0000 RUB' }

function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('заявление о трансляции паевого взноса в Цифровой Кошелёк', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
  })

  it(`заявление ${STATEMENT.registry_id} генерируется и воспроизводится с тем же хэшем`, async () => {
    await testDocumentGeneration({ ...BASE, ...STATEMENT } as never)
  })

  it('заявление просит транслировать паевой взнос на названную сумму — и ничего сверх того', async () => {
    const t = plainText((await generator.generate({ ...BASE, ...STATEMENT } as never)).html)
    expect(t).toContain('ЗАЯВЛЕНИЕ')
    expect(t).toContain('о трансляции паевого взноса')
    expect(t).toContain('Прошу транслировать мой паевой взнос по Целевой Потребительской Программе «Образование» в сумме 1500.00 RUB в Целевую Потребительскую Программу «Цифровой Кошелёк».')
    expect(t).toContain('Подписано электронной подписью.')
    expect(t).not.toContain('Договор')
    expect(t).not.toContain('Приложение №')
    expect(t).not.toContain('1500.0000')
  })
})
