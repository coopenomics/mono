// Трёхстороннее слияние текста сущностей и снимки базы (.blago/base/<type>/<hash>.md).

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { merge as diff3Merge } from 'node-diff3'

import { baseSnapshotPath } from '../config/paths.js'

export interface Merge3Result {
  /** Слитый текст; при конфликте — с маркерами `<<<<<<< blago/local` / `||||||| blago/base` / `>>>>>>> blago/remote` */
  text: string
  conflict: boolean
}

/**
 * diff3 построчно: `ours` — локальный файл, `base` — снимок сервера на момент последнего sync,
 * `theirs` — свежий серверный текст. Одинаковые правки с обеих сторон конфликтом не считаются.
 */
export function merge3(ours: string, base: string, theirs: string): Merge3Result {
  const res = diff3Merge(ours, base, theirs, {
    excludeFalseConflicts: true,
    stringSeparator: /\r?\n/,
    label: { a: 'blago/local', o: 'blago/base', b: 'blago/remote' },
  })
  return { text: res.result.join('\n'), conflict: res.conflict }
}

export async function loadBaseSnapshot(root: string, entityType: string, entityHash: string): Promise<string | null> {
  try {
    return await fs.readFile(baseSnapshotPath(root, entityType, entityHash), 'utf8')
  }
  catch {
    return null
  }
}

export async function saveBaseSnapshot(root: string, entityType: string, entityHash: string, content: string): Promise<void> {
  const abs = baseSnapshotPath(root, entityType, entityHash)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf8')
}

export async function removeBaseSnapshot(root: string, entityType: string, entityHash: string): Promise<void> {
  try {
    await fs.unlink(baseSnapshotPath(root, entityType, entityHash))
  }
  catch {
    // снимка могло не быть
  }
}

/** Конфликт редакций от сервера (GraphQL `extensions.code = CONTENT_CONFLICT`): ничего не сохранено. */
export interface ServerContentConflict {
  base_rev: number
  current_rev: number
  title_conflict: boolean
  description_conflict: boolean
  ours: { title: string, description: string }
  theirs: { title: string, description: string }
  base: { title: string, description: string } | null
  /** Тело с маркерами ours/base/theirs; пусто для XML-форматов */
  marked: string
}

export function extractServerContentConflict(error: unknown): ServerContentConflict | null {
  const response = (error as { response?: { errors?: unknown[] } } | null)?.response
  const errors = Array.isArray(response?.errors) ? response.errors : []
  for (const e of errors as Array<{ extensions?: { code?: string, conflict?: ServerContentConflict } }>) {
    if (e?.extensions?.code === 'CONTENT_CONFLICT' && e.extensions.conflict) {
      return e.extensions.conflict
    }
  }
  return null
}
