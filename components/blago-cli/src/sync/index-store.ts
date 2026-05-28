// index.json + staging.json: путь и etag содержимого после последнего pull/push.

import * as fs from 'node:fs/promises'

import { indexPath, stagingPath } from '../config/paths.js'

import { isPullOnlyCommunicationRelativePath } from './pull-only-paths.js'

export type BlagoEntityType =
  | 'project'
  | 'issue'
  | 'story'
  /** Файл `messages/YYYY-MM-DD.md` (история Matrix), только pull с сервера */
  | 'room_message_day'
  /** Файл `meetings/*.md` (транскрипция звонка), только pull с сервера */
  | 'call_transcription'
  /** Файл `meetings/<stem>.memo.md` — краткое содержание звонка; pull с сервера + публикация через `blago transcription memo` */
  | 'call_transcription_memo'

export interface IndexEntry {
  entity_type: BlagoEntityType
  entity_hash: string
  relative_path: string
  remote_updated_at: string
  content_etag_local: string
}

export interface IndexFile {
  entries: IndexEntry[]
}

export interface StagingFile {
  paths: string[]
}

export async function loadIndex(root: string): Promise<IndexFile> {
  try {
    const raw = await fs.readFile(indexPath(root), 'utf8')
    const parsed = JSON.parse(raw) as IndexFile
    if (!Array.isArray(parsed.entries)) {
      return { entries: [] }
    }
    return parsed
  }
  catch {
    return { entries: [] }
  }
}

export async function saveIndex(root: string, index: IndexFile): Promise<void> {
  await fs.writeFile(indexPath(root), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
}

export function findByHash(index: IndexFile, type: BlagoEntityType, hash: string): IndexEntry | undefined {
  return index.entries.find(e => e.entity_type === type && e.entity_hash === hash)
}

export function findByRelativePath(index: IndexFile, relativePath: string): IndexEntry | undefined {
  const n = normalizeRelativePath(relativePath)
  return index.entries.find(e => normalizeRelativePath(e.relative_path) === n)
}

export function upsertEntry(index: IndexFile, entry: IndexEntry): void {
  const i = index.entries.findIndex(e => e.entity_type === entry.entity_type && e.entity_hash === entry.entity_hash)
  if (i >= 0) {
    index.entries[i] = entry
  }
  else {
    index.entries.push(entry)
  }
}

export async function loadStaging(root: string): Promise<StagingFile> {
  try {
    const raw = await fs.readFile(stagingPath(root), 'utf8')
    const parsed = JSON.parse(raw) as StagingFile
    if (!Array.isArray(parsed.paths)) {
      return { paths: [] }
    }
    return parsed
  }
  catch {
    return { paths: [] }
  }
}

export async function saveStaging(root: string, staging: StagingFile): Promise<void> {
  await fs.writeFile(stagingPath(root), `${JSON.stringify(staging, null, 2)}\n`, 'utf8')
}

/** Добавить пути в staging без проверки «грязности» (после create). */
export async function appendPathsToStaging(root: string, paths: string[]): Promise<void> {
  const staging = await loadStaging(root)
  const set = new Set(staging.paths.map(p => normalizeRelativePath(p)))
  for (const p of paths) {
    const rel = normalizeRelativePath(p)
    if (!isPullOnlyCommunicationRelativePath(rel)) {
      set.add(rel)
    }
  }
  await saveStaging(root, { paths: [...set].sort() })
}

/** Заменить один путь в staging (после переименования файла при push). */
export async function replaceStagingPath(root: string, fromRel: string, toRel: string): Promise<void> {
  const from = normalizeRelativePath(fromRel)
  const to = normalizeRelativePath(toRel)
  const staging = await loadStaging(root)
  const next = staging.paths.map(p => (normalizeRelativePath(p) === from ? to : p))
  await saveStaging(root, { paths: [...new Set(next)].sort() })
}

export function normalizeRelativePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '')
}
