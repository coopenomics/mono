/**
 * Документ не ходит наружу при сборке PDF (factory.document-external-resources).
 *
 * Шаблоны собираются без автоэкранирования, поэтому текст с разметкой
 * становится разметкой документа. Формулировки вопросов повестки собрания —
 * свободный текст, угловые скобки там не запрещены, и через них в документ
 * попадают ссылки на ресурсы. Сборщик PDF обязан загружать только data:.
 *
 * Снаружи это видно по самому PDF и по времени сборки:
 *  - file:// на исполняемый файл node (десятки мегабайт) не вкладывается —
 *    документ не тяжелеет на его размер;
 *  - http:// на немаршрутизируемый адрес не вызывается — иначе сборка ждала
 *    бы соединения на каждой ссылке, и документ собирался бы десятки секунд;
 *  - data:-картинка (так приезжает собственноручная подпись) рисуется — в
 *    PDF появляется ещё одно изображение.
 */
import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, gql, tokenOf } from '../core'

const GENERATE_AGENDA = `mutation($d:AnnualGeneralMeetingAgendaGenerateDocumentInput!){
  generateAnnualGeneralMeetAgendaDocument(data:$d){ html binary hash }
}`

async function agenda(title: string) {
  const started = Date.now()
  const d = await gql<any>(await tokenOf(CHAIRMAN), GENERATE_AGENDA, {
    d: {
      coopname: COOP,
      username: CHAIRMAN.account,
      is_repeated: false,
      meet: { type: 'regular', open_at_datetime: '2026-12-01T10:00:00.000Z', close_at_datetime: '2026-12-10T10:00:00.000Z' },
      questions: [{ number: '1', title, decision: 'Утвердить', context: 'Пояснение' }],
    },
  })
  const doc = d.generateAnnualGeneralMeetAgendaDocument
  const pdf = Buffer.from(doc.binary, 'base64')
  // Картинки и вложения в PDF — всегда отдельные потоки со словарём в открытом
  // виде (в сжатый поток объектов потоки не кладутся), поэтому их видно по тексту.
  const raw = pdf.toString('latin1')
  return {
    html: doc.html as string,
    pdfBytes: pdf.length,
    images: (raw.match(/\/Subtype\s*\/Image/g) ?? []).length,
    attachments: (raw.match(/\/EmbeddedFile/g) ?? []).length,
    ms: Date.now() - started,
  }
}

/** PNG из шума: не сжимается, поэтому его размер виден в размере PDF. */
function noisePng(side: number): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let c = 0xFFFFFFFF
    for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(side, 0)
  ihdr.writeUInt32BE(side, 4)
  ihdr[8] = 8 // глубина
  ihdr[9] = 2 // RGB
  const rows: Buffer[] = []
  let seed = 1
  for (let y = 0; y < side; y++) {
    const row = Buffer.alloc(1 + side * 3)
    for (let i = 1; i < row.length; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0
      row[i] = seed >>> 24
    }
    rows.push(row)
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}

describe('factory.document-external-resources: сборка PDF без обращений наружу', () => {
  it(caseName('factory.docext.break.01', 'сетевые ссылки — картинка, фон, @import — не загружаются, документ собирается без них'), async () => {
    const base = await agenda('Об утверждении отчёта')
    const blackhole = 'http://10.255.255.1'
    const evil = await agenda([
      'Об утверждении отчёта',
      `<img src="${blackhole}/a.png">`,
      `<div style="background-image:url(${blackhole}/b.png)">фон</div>`,
      `<style>@import url("${blackhole}/c.css");</style>`,
      `<link rel="stylesheet" href="${blackhole}/d.css">`,
    ].join(' '))
    // Ссылки дошли до документа — проверка не пустая.
    expect(evil.html).toContain(`${blackhole}/a.png`)
    expect(evil.html).toContain(`${blackhole}/c.css`)
    // Четыре обращения к немаршрутизируемому адресу ждали бы соединения
    // каждое; сборка без них укладывается в время обычного документа.
    expect(evil.ms).toBeLessThan(base.ms + 8_000)
    expect(Math.abs(evil.pdfBytes - base.pdfBytes)).toBeLessThan(20_000)
    expect(evil.images).toBe(base.images)
  })

  it(caseName('factory.docext.break.02', 'file:// на файл контейнера в PDF не попадает — вес документа не растёт'), async () => {
    const base = await agenda('Об утверждении отчёта')
    const node = 'file:///usr/local/bin/node'
    const evil = await agenda([
      'Об утверждении отчёта',
      `<img src="${node}">`,
      `<a rel="attachment" href="${node}">приложение</a>`,
      `<link rel="attachment" href="file:///etc/passwd">`,
    ].join(' '))
    expect(evil.html).toContain(node)
    // Исполняемый файл node весит десятки мегабайт; вложенный, он раздул бы PDF.
    expect(evil.pdfBytes - base.pdfBytes).toBeLessThan(50_000)
    expect(evil.images).toBe(base.images)
    expect(evil.attachments).toBe(0)
  })

  it(caseName('factory.docext.happy.01', 'data:-картинка (собственноручная подпись) рисуется внутри документа'), async () => {
    const base = await agenda('Об утверждении отчёта')
    const signature = noisePng(160)
    const withImage = await agenda(`Об утверждении отчёта <img src="${signature}" style="width:40mm">`)
    // Картинка легла в PDF отдельным изображением и прибавила ему веса.
    expect(withImage.images).toBe(base.images + 1)
    expect(withImage.pdfBytes - base.pdfBytes).toBeGreaterThan(10_000)
  })
})
