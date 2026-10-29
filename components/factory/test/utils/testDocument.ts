import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { expect } from 'vitest'
import { loadBufferFromDisk } from '../../src/Utils/loadBufferFromDisk'
import { saveBufferToDisk } from '../../src/Utils/saveBufferToDisk'
import type { IGenerate, IGeneratedDocument } from '../../src'
import { calculateSha256 } from '../../src/Utils/calculateSHA'
import { GOLDEN_CREATED_AT, GOLDEN_VERSION, matchGolden } from './golden'
import { generator } from '.'

export async function testDocumentGeneration<T extends IGenerate = IGenerate>(
  params: T, // Динамический объект с любыми параметрами
) {
  // Дата сборки фиксируется, иначе эталон менялся бы каждым прогоном
  // (см. test/utils/golden.ts). Тест, которому нужна своя дата, задаёт её сам.
  // Версия генератора в мете по умолчанию равна версии пакета и меняется
  // каждым выпуском; она впечатывается в PDF (Creator и отпечаток меты), и
  // хэш PDF плыл бы от релиза к релизу. В наборе версия закреплена.
  //
  // Закрепляются они часами и версией генератора, а не полями данных: дата в
  // данных означает пересборку по мете (шаг 7), и документ собрался бы как
  // старый — без версии сборщика в мете.
  const { created_at, version, ...rest } = params as T & { created_at?: string, version?: string }
  generator.setMetaDeps({ now: () => created_at ?? GOLDEN_CREATED_AT, version: version ?? GOLDEN_VERSION })
  const input = rest as T

  const startedAt = Date.now()
  const document: IGeneratedDocument = await generator.generate(input)
  const elapsedMs = Date.now() - startedAt

  // Эталон: HTML, мета и хэш PDF документа до любого рефакторинга.
  await matchGolden(document, elapsedMs)

  // Генерируем уникальный суффикс для имен файлов
  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 7)

  const filename1 = `${params.registry_id}.${document.meta.title}-${document.meta.username}-${uniqueSuffix}.pdf`
  await saveBufferToDisk(document.binary, filename1)
  // Сохраняем копию в уникальную директорию без uniqueSuffix
  const uniqueDocFilename = path.join('__unique_docs__', `${params.registry_id}.${document.meta.title}-${document.meta.username}.pdf`)
  await saveBufferToDisk(document.binary, uniqueDocFilename)

  // Пересборка по мете идёт через другой воркер WeasyPrint (пул из двух,
  // выдача по кругу — WEASY_POOL_SIZE в конфиге набора): хэш PDF обязан
  // совпасть между процессами, а не только внутри одного.
  const regenerated_document: IGeneratedDocument = await generator.generate({
    ...document.meta,
  })

  const filename2 = `${params.registry_id}.${document.meta.title}-${document.meta.username}-regenerated-${uniqueSuffix}.pdf`
  await saveBufferToDisk(regenerated_document.binary, filename2)

  expect(document.meta).toEqual(regenerated_document.meta)
  expect(document.hash).toEqual(regenerated_document.hash)
  expect(document.html).toEqual(regenerated_document.html)

  const document_from_disk1 = await loadBufferFromDisk(filename1)
  const document_from_disk2 = await loadBufferFromDisk(filename2)

  const hash1 = calculateSha256(document_from_disk1)
  const hash2 = calculateSha256(document_from_disk2)

  const getted_document = await generator.getDocument({ hash: regenerated_document.hash })

  expect(getted_document).toBeDefined()
  expect(getted_document.hash).toEqual(document.hash)

  expect(hash1).toEqual(hash2)

  return document
}
