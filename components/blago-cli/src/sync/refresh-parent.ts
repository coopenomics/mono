// После create/del дочерней issue/story сервер бьёт _updated_at родительского проекта.
// Без обновления записи индекса родителя следующий push падает с конфликтом версий
// (а pull может затереть локальные правки маркерами слияния). Этот хелпер освежает
// remote_updated_at в индексе, не теряя несохранённые правки в файле проекта/компонента.

import type { AuthenticatedContext } from '../session/index.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { Queries } from '@coopenomics/sdk'

import { projectToFrontmatterAndBody, serializeBlagoMarkdown } from '../format/index.js'
import { sha256Hex } from '../lib/hash.js'
import { effectiveParentHash } from '../lib/parent-hash.js'
import {
  findByHash,
  type IndexFile,
  normalizeRelativePath,
  upsertEntry,
} from './index-store.js'

interface CapitalProjectRow {
  id?: number | null
  project_hash: string
  title?: string | null
  description?: string | null
  coopname: string
  parent_hash?: string | null
  parent_title?: string | null
  status?: string | null
  created_at?: Date | string | null
  _updated_at?: Date | string | null
}

function toIso(v: Date | string | null | undefined): string {
  if (v === undefined || v === null) {
    return ''
  }
  if (v instanceof Date) {
    return v.toISOString()
  }
  return new Date(v).toISOString()
}

/**
 * Освежить запись индекса родительского проекта/компонента после мутации, которая на сервере
 * бьёт его _updated_at (создание/удаление дочерней issue или story).
 *
 * - Если файл проекта/компонента «чистый» (etag совпадает с индексом) — переписываем файл
 *   свежим контентом с сервера и обновляем remote_updated_at + content_etag_local.
 * - Если файл «грязный» (есть локальные правки) — обновляем только remote_updated_at,
 *   оставляя локальные правки нетронутыми. После такого освежения blago push сравнит
 *   индекс с сервером и не найдёт конфликта.
 *
 * Тихие сбои: проекта нет в индексе / GraphQL недоступен / версия не сменилась → no-op.
 *
 * Безопасность от параллельной правки другим пользователем: если контент проекта на сервере
 * отличается от того, что мы знали в индексе (по реконструированному etag без _updated_at),
 * мы не выполняем «оптимистичный» bump — оставляем remote_updated_at прежним, чтобы
 * пользователь увидел реальный конфликт при ближайшем push.
 */
export async function refreshParentProjectVersion(
  ctx: AuthenticatedContext,
  index: IndexFile,
  projectHash: string,
  parentHashHint: string | null | undefined,
): Promise<void> {
  const entry = findByHash(index, 'project', projectHash)
  if (!entry) {
    return
  }
  const parentHash = effectiveParentHash(parentHashHint ?? undefined)
  let row: CapitalProjectRow | null = null
  try {
    const q = await ctx.client.Query(Queries.Capital.GetProject.query, {
      variables: {
        data: {
          hash: projectHash,
          parent_hash: parentHash,
        },
      },
    })
    row = (q[Queries.Capital.GetProject.name] as CapitalProjectRow | null) ?? null
  }
  catch {
    return
  }
  if (!row) {
    return
  }
  const newRemoteAt = toIso(row._updated_at)
  if (!newRemoteAt || newRemoteAt === entry.remote_updated_at) {
    return
  }

  const rel = normalizeRelativePath(entry.relative_path)
  const abs = path.join(ctx.root, rel)
  let onDisk: string | null = null
  try {
    onDisk = await fs.readFile(abs, 'utf8')
  }
  catch {
    onDisk = null
  }

  // Реконструируем «как выглядел бы файл» с сервера, но с _updated_at == прежнее значение из индекса:
  // если получится то же содержимое, что в индексе по etag — содержимое (title/description) не менялось,
  // bump _updated_at действительно «наш» (вызван дочерней мутацией) и его безопасно записать в индекс.
  const previewRow: CapitalProjectRow = { ...row, _updated_at: entry.remote_updated_at }
  const { data: prevData, body: prevBody } = projectToFrontmatterAndBody(previewRow)
  const previewEtag = sha256Hex(serializeBlagoMarkdown(prevData, prevBody))
  const contentUnchangedOnServer = previewEtag === entry.content_etag_local

  if (!contentUnchangedOnServer) {
    // Сервер опередил нас (правка извне или через другую копию) — не трогаем индекс,
    // пусть push выявит реальный конфликт и пользователь сделает осознанный pull.
    return
  }

  const isDirty = onDisk !== null && sha256Hex(onDisk) !== entry.content_etag_local
  if (!isDirty) {
    const { data, body } = projectToFrontmatterAndBody(row)
    const content = serializeBlagoMarkdown(data, body)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, content, 'utf8')
    const etag = sha256Hex(await fs.readFile(abs, 'utf8'))
    upsertEntry(index, {
      entity_type: 'project',
      entity_hash: projectHash,
      relative_path: rel,
      remote_updated_at: newRemoteAt,
      content_etag_local: etag,
    })
    return
  }

  upsertEntry(index, {
    entity_type: 'project',
    entity_hash: projectHash,
    relative_path: rel,
    remote_updated_at: newRemoteAt,
    content_etag_local: entry.content_etag_local,
  })
}
