import { beforeAll, describe, expect, it } from 'vitest'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Заявление о прекращении участия в ЦПП «Образование» (3013). Членский взнос
 * программы возвращается в паевой только с прекращением участия, поэтому
 * заявление просит именно этого: закрыть подписки с возвратом по Положению и
 * вернуть весь остаток в паевой — после согласования Обществом.
 */
function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const BASE = {
  registry_id: 3013,
  coopname: 'voskhod',
  username: 'ant',
  lang: 'ru',
}

async function generate(data: Record<string, unknown> = {}): Promise<IGeneratedDocument> {
  return generator.generate({ ...BASE, ...data } as never)
}

describe('Заявление о прекращении участия в ЦПП «Образование»', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
  })

  it('генерируется и воспроизводится с тем же хэшем', async () => {
    await testDocumentGeneration(BASE as never)
  })

  it('просит прекратить участие в программе', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('о прекращении участия в Целевой Потребительской Программе «Образование»')
    expect(text).toContain('Прошу прекратить моё участие в Целевой Потребительской Программе «Образование».')
  })

  it('называет судьбу подписок и остатка: возврат по Положению и весь остаток в паевой', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('закрыть с возвратом членских взносов по Положению')
    expect(text).toContain('весь остаток моего членского взноса по программе вернуть в мой паевой взнос по Целевой Потребительской Программе «Цифровой Кошелёк»')
  })

  it('оговаривает согласование Обществом', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('после согласования настоящего заявления Обществом')
  })
})
