import type { AddressInfo } from 'node:net'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PDFService } from '../src/Services/Generator'
import { signatureExample } from './signatureExample'

/**
 * Документ не имеет права ходить наружу при сборке PDF.
 *
 * Шаблоны собираются с выключенным автоэкранированием, поэтому имя, адрес или
 * название организации с угловыми скобками становятся разметкой. Пока сборщик
 * PDF загружал всё, на что ссылается разметка, такая ссылка означала две вещи
 * сразу: `file://` вкладывал в готовый документ файл контейнера, а `http://`
 * заставлял сервер сходить во внутреннюю сеть — с его адреса и его правами.
 *
 * Разрешён только `data:` — так приезжает собственноручная подпись пайщика,
 * она едет внутри самого документа.
 */

const meta: any = {
  title: 'Проба',
  lang: 'ru',
  registry_id: 100,
  generator: 'factory',
  version: '1.0.0',
  created_at: '01.01.2020 00:00',
  timezone: 'Europe/Moscow',
  coopname: 'voskhod',
  username: 'ant',
  block_num: 1,
  links: [],
}

const service = new PDFService()

/** Ловушка: считает, сколько раз сборщик документа постучался по сети. */
let requestedPaths: string[] = []
let origin = ''
const trap = createServer((req, res) => {
  requestedPaths.push(req.url ?? '')
  res.writeHead(200, { 'Content-Type': 'image/png' })
  res.end(Buffer.alloc(0))
})

beforeAll(async () => {
  await new Promise<void>(resolve => trap.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(trap.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>(resolve => trap.close(() => resolve()))
})

describe('внешние ресурсы при сборке PDF', () => {
  it('ссылка в сеть не выполняется', async () => {
    requestedPaths = []
    const html = `
      <style>@import url("${origin}/imported.css");</style>
      <div style="background-image: url('${origin}/background.png')">
        <img src="${origin}/picture.png"/>
      </div>`

    const doc = await service.generateDocument(html, {}, {} as any, meta)

    expect(requestedPaths).toEqual([])
    expect(doc.binary.length).toBeGreaterThan(0)
  })

  it('локальный файл в документ не попадает', async () => {
    // Содержимое PDF сжато, поэтому вложение ловим по весу: файл заметного
    // размера, попав в документ, увеличил бы его на свою величину.
    const secretPath = path.join(os.tmpdir(), `factory-secret-${Date.now()}.jpg`)
    fs.writeFileSync(secretPath, Buffer.from(signatureExample.split(',')[1], 'base64'))
    const secretSize = fs.statSync(secretPath).size
    try {
      const withFile = await service.generateDocument(
        `<div><img src="file://${secretPath}"/></div>`,
        {},
        {} as any,
        meta,
      )
      const withoutFile = await service.generateDocument('<div><img src=""/></div>', {}, {} as any, meta)

      expect(withFile.binary.length).toBeLessThan(withoutFile.binary.length + secretSize / 2)
    }
    finally {
      fs.unlinkSync(secretPath)
    }
  })

  it('собственноручная подпись рисуется по-прежнему', async () => {
    const withSignature = await service.generateDocument(
      `<div><img style="max-width: 150px;" src="${signatureExample}"/></div>`,
      {},
      {} as any,
      meta,
    )
    const withoutSignature = await service.generateDocument(
      '<div><img style="max-width: 150px;" src=""/></div>',
      {},
      {} as any,
      meta,
    )

    // Картинка внутри документа весит своё: без неё PDF в разы легче.
    expect(withSignature.binary.length).toBeGreaterThan(withoutSignature.binary.length * 4)
  })
})
