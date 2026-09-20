import { beforeAll, describe, expect, it } from 'vitest'
import type { IGeneratedDocument } from '../src'
import { testDocumentGeneration } from './utils/testDocument'
import { generator, mongoUri } from './utils'

/**
 * Заявление об аннулировании соглашений ЦПП (190) — один документ на все
 * программы пайщика. Проверяется, что программы печатаются таблицей, кошельки
 * делятся на возвратные и остающиеся кооперативу, а оговорка о причитающейся
 * сумме стоит в тексте.
 */
function plainText(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const PROGRAMS = [
  {
    program_id: 5,
    title: 'Образование',
    agreement_signed_at: '02.09.2026',
    agreement_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f801',
    wallets: [
      { wallet_name: 'w.edu.member', human_name: 'Членский взнос ЦПП «Образование»', balance: '10000.0000 RUB', returns: true },
    ],
    refund: '10000.0000 RUB',
  },
  {
    program_id: 2,
    title: 'Стол заказов',
    agreement_signed_at: '14.05.2026',
    agreement_hash: 'b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f801a2',
    wallets: [
      { wallet_name: 'w.mkt.share', human_name: 'Паевой взнос ЦПП «Стол заказов»', balance: '2500.0000 RUB', returns: true },
      { wallet_name: 'w.mkt.member', human_name: 'Членский взнос ЦПП «Стол заказов»', balance: '300.0000 RUB', returns: false },
    ],
    refund: '2500.0000 RUB',
  },
]

const BASE = {
  registry_id: 190,
  coopname: 'voskhod',
  username: 'ant',
  lang: 'ru',
  exit_hash: '55c470039a8c53ce1b4b6e842fe8063ab3d5b85ba2ba8ab0ae6e30be3ad328b7',
  programs: PROGRAMS,
  total_refund: '12500.0000 RUB',
}

async function generate(data: Record<string, unknown> = {}): Promise<IGeneratedDocument> {
  return generator.generate({ ...BASE, ...data } as never)
}

describe('Заявление об аннулировании соглашений ЦПП', async () => {
  beforeAll(async () => {
    await generator.connect(mongoUri)
  })

  it('генерируется и воспроизводится с тем же хэшем', async () => {
    await testDocumentGeneration(BASE as never)
  })

  it('перечисляет программы с датой соглашения и остатками кошельков', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('1. Образование')
    expect(text).toContain('2. Стол заказов')
    expect(text).toContain('Соглашение подписано: 02.09.2026')
    expect(text).toContain('Членский взнос ЦПП «Образование» — 10000.00 RUB')
    expect(text).toContain('Итого к переводу на главный паевой кошелёк: 12500.00 RUB')
  })

  it('делит кошельки на возвратные и остающиеся кооперативу', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('Членский взнос ЦПП «Образование» — 10000.00 RUB (возвращается на главный паевой кошелёк)')
    expect(text).toContain('Членский взнос ЦПП «Стол заказов» — 300.00 RUB (остаётся Обществу по условиям Положения программы)')
  })

  it('содержит оговорку о причитающейся сумме и об отсутствии иных требований', async () => {
    const text = plainText((await generate()).html)
    expect(text).toContain('к возврату мне причитаются остатки на кошельках перечисленных программ')
    expect(text).toContain('иных требований по этим программам к Обществу я не имею')
    expect(text).toContain('Сумму перевода Общество определяет на день принятия решения Советом')
  })

  it('без выхода из кооператива связи с заявлением на выход в тексте нет', async () => {
    const withExit = plainText((await generate()).html)
    expect(withExit).toContain('в связи с моим выходом из состава пайщиков')

    const alone = plainText((await generate({ exit_hash: undefined })).html)
    expect(alone).not.toContain('в связи с моим выходом из состава пайщиков')
    expect(alone).toContain('Прошу аннулировать мои соглашения об участии в целевых потребительских программах Общества')
  })
})
