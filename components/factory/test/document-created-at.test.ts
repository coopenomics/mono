/**
 * Дата создания документа и уникальность его хэша (C28-84).
 *
 * Дата в мете была до минуты, и две генерации одного заявления в одну минуту
 * давали один `doc_hash` при разной мете: сверка подписи брала из базы чужую
 * версию черновика и отбивала повторную подпись как подмену. Теперь мета хранит
 * момент в ISO до миллисекунд, а в свойства файла вписывается её отпечаток.
 */
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { PDFService } from '../src/Services/Generator'
import { formatCreatedAt, isLegacyCreatedAt, parseCreatedAt, splitCreatedAt } from '../src'
import { documentMetaKey } from '../src/Utils/documentMetaKey'

const TZ = 'Europe/Moscow'

describe('дата меты документа', () => {
  it('дата в ISO показывается человеку в поясе документа', () => {
    expect(formatCreatedAt('2026-09-24T11:05:31.123Z', TZ)).toBe('24.09.2026 14:05')
    expect(splitCreatedAt('2026-09-24T11:05:31.123Z', TZ)).toEqual({ date: '24.09.2026', time: '14:05' })
  })

  it('старая дата «ДД.ММ.ГГГГ ЧЧ:ММ» показывается как есть и разбирается в поясе документа', () => {
    expect(isLegacyCreatedAt('24.09.2026 14:05')).toBe(true)
    expect(formatCreatedAt('24.09.2026 14:05', TZ)).toBe('24.09.2026 14:05')
    expect(splitCreatedAt('24.09.2026 14:05', TZ)).toEqual({ date: '24.09.2026', time: '14:05' })
    expect(parseCreatedAt('24.09.2026 14:05', TZ).toISOString()).toBe('2026-09-24T11:05:00.000Z')
  })

  it('дата, записанная вручную, в показе остаётся как есть', () => {
    expect(formatCreatedAt('12.01.2026', TZ)).toBe('12.01.2026')
  })

  it('непонятную дату разбор не выдумывает', () => {
    expect(() => parseCreatedAt('вчера', TZ)).toThrow()
  })
})

const baseMeta: any = {
  title: 'Заявление',
  lang: 'ru',
  registry_id: 1020,
  generator: 'coopjs',
  version: '1.0.0',
  timezone: TZ,
  coopname: 'voskhod',
  username: 'qpwllavspkog',
  block_num: 136778152,
  links: [],
}

const html = '<div class="digital-document"><p>Прошу принять взнос 15000.00 RUB</p><p>{{ created_at }}</p></div>'
const vars = { meta: baseMeta, created_at: '24.09.2026 14:05' }

async function keywordsOf(binary: Uint8Array): Promise<string | undefined> {
  return (await PDFDocument.load(binary)).getKeywords()
}

describe('хэш документа различает генерации', () => {
  const service = new PDFService()

  it('две генерации в одну минуту дают разные хэши', async () => {
    const first = await service.generateDocument(html, vars, {}, { ...baseMeta, created_at: '2026-09-24T11:05:23.410Z' })
    const second = await service.generateDocument(html, vars, {}, { ...baseMeta, created_at: '2026-09-24T11:05:31.123Z', block_num: 136778169 })
    expect(first.hash).not.toBe(second.hash)
  })

  it('перегенерация из той же меты даёт тот же хэш', async () => {
    const meta = { ...baseMeta, created_at: '2026-09-24T11:05:23.410Z' }
    const first = await service.generateDocument(html, vars, {}, meta)
    const again = await service.generateDocument(html, vars, {}, { ...meta })
    expect(again.hash).toBe(first.hash)
    expect(await keywordsOf(first.binary)).toBe(`meta:${documentMetaKey(meta)}`)
  })

  it('документ со старой датой собирается без отпечатка — как был подписан', async () => {
    const legacy = await service.generateDocument(html, vars, {}, { ...baseMeta, created_at: '24.09.2026 14:05' })
    expect(await keywordsOf(legacy.binary)).toBeUndefined()
  })
})
