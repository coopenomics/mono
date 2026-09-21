import { beforeAll, describe, expect, it } from 'vitest'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Заявление о возврате членского взноса по ЦПП «Образование» в паевой взнос
 * (3013). Проверяется, что заявление называет сумму, обе программы и оговорку
 * о согласовании Обществом, которого требует Положение.
 */
function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const BASE = {
  registry_id: 3013,
  coopname: 'voskhod',
  username: 'ant',
  lang: 'ru',
  amount: '1250.5000 RUB',
}

async function generate(data: Record<string, unknown> = {}): Promise<IGeneratedDocument> {
  return generator.generate({ ...BASE, ...data } as never)
}

describe('Заявление о возврате членского взноса в паевой взнос', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
  })

  it('генерируется и воспроизводится с тем же хэшем', async () => {
    await testDocumentGeneration(BASE as never)
  })

  it('называет сумму человеческим форматом и обе программы', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('о возврате членского взноса по Целевой Потребительской Программе «Образование» в паевой взнос')
    expect(text).toContain('в размере 1250.50 RUB')
    expect(text).toContain('в мой паевой взнос по Целевой Потребительской Программе «Цифровой Кошелёк»')
  })

  it('оговаривает согласование Обществом', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('после согласования настоящего заявления Обществом')
  })

  it('сумма уходит в мету документа как в цепи — по ней кооператив проводит возврат', async () => {
    const document = await generate()
    expect((document.meta as unknown as { amount: string }).amount).toBe('1250.5000 RUB')
  })
})
