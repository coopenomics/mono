// Публикация поля memo транскрипции на сервер (мутация chatcoopUpdateTranscriptionMemo).
//
// Связь meeting-файла с UUID транскрипции: `.blago/index.json` хранит entity_type=call_transcription
// и entity_hash=<uuid в lower-case> для каждого `meetings/<stem>.md` (см. pull-communication.ts).
//
// Текст memo берётся:
//   1) --text "<inline>" — приоритет;
//   2) --file <path>     — читать markdown из файла;
//   3) sibling .memo.md  — если <pathOrId> это meeting-файл, берём `<meetings>/<stem>.memo.md` рядом.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { Mutations } from '@coopenomics/sdk'

import type { AuthenticatedContext } from '../session/index.js'
import { sha256Hex } from '../lib/hash.js'
import {
  findByRelativePath,
  type IndexFile,
  loadIndex,
  normalizeRelativePath,
  saveIndex,
  upsertEntry,
} from './index-store.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface UpdateTranscriptionMemoOptions {
  readonly inlineText?: string
  readonly filePath?: string
}

export interface UpdateTranscriptionMemoResult {
  readonly transcriptionId: string
  readonly memoLength: number
  readonly memoSource: 'inline' | 'file' | 'sibling'
  readonly memoFile?: string
}

/** Пара значений: id транскрипции для мутации + опциональный «meeting абсолютный путь» для sibling-резолва. */
interface ResolvedTranscription {
  readonly id: string
  readonly meetingAbsPath?: string
}

function resolveTranscription(
  ctxRoot: string,
  cwd: string,
  pathOrId: string,
  index: IndexFile,
): ResolvedTranscription {
  const trimmed = pathOrId.trim()
  if (UUID_RE.test(trimmed)) {
    return { id: trimmed.toLowerCase() }
  }
  const abs = path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed)
  const rel = path.relative(ctxRoot, abs)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Путь «${pathOrId}» вне рабочей копии blago (${ctxRoot}). Передайте путь относительно корня копии или UUID транскрипции.`,
    )
  }
  const entry = findByRelativePath(index, normalizeRelativePath(rel))
  if (!entry) {
    throw new Error(
      `В .blago/index.json нет записи для «${rel}». Выполните «blago pull», чтобы подтянуть транскрипции.`,
    )
  }
  if (entry.entity_type !== 'call_transcription') {
    throw new Error(
      `Файл «${rel}» имеет тип «${entry.entity_type}», а не «call_transcription». Передайте путь к meeting-файлу или UUID.`,
    )
  }
  return { id: entry.entity_hash, meetingAbsPath: abs }
}

function buildSiblingMemoPath(meetingAbsPath: string): string {
  const dir = path.dirname(meetingAbsPath)
  const ext = path.extname(meetingAbsPath)
  const stem = path.basename(meetingAbsPath, ext)
  return path.join(dir, `${stem}.memo.md`)
}

async function readMemoText(
  cwd: string,
  resolved: ResolvedTranscription,
  options: UpdateTranscriptionMemoOptions,
): Promise<{ text: string, source: UpdateTranscriptionMemoResult['memoSource'], file?: string }> {
  if (typeof options.inlineText === 'string') {
    return { text: options.inlineText, source: 'inline' }
  }
  if (options.filePath !== undefined && options.filePath.length > 0) {
    const abs = path.isAbsolute(options.filePath) ? options.filePath : path.resolve(cwd, options.filePath)
    const text = await fs.readFile(abs, 'utf8')
    return { text, source: 'file', file: abs }
  }
  if (!resolved.meetingAbsPath) {
    throw new Error(
      'Не указан текст memo. Передайте --text "<строка>" или --file <путь>, либо первым аргументом — путь к meeting-файлу (тогда читается `<stem>.memo.md` рядом).',
    )
  }
  const siblingAbs = buildSiblingMemoPath(resolved.meetingAbsPath)
  try {
    const text = await fs.readFile(siblingAbs, 'utf8')
    return { text, source: 'sibling', file: siblingAbs }
  }
  catch {
    throw new Error(
      `Рядом с «${path.basename(resolved.meetingAbsPath)}» нет файла «${path.basename(siblingAbs)}». Выполните «blago pull» (он создаст sibling-файл; пустой, если на сервере memo пустой), затем отредактируйте и повторите команду — либо передайте --file / --text.`,
    )
  }
}

function toIso(v: unknown, fallback: Date): string {
  if (v instanceof Date) {
    return v.toISOString()
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString()
    }
  }
  return fallback.toISOString()
}

/**
 * После успешной мутации записываем `meetings/<stem>.memo.md` рядом с meeting-файлом и
 * заносим запись в `.blago/index.json` с типом `call_transcription_memo`, чтобы:
 *  - следующий `blago pull` видел индексированный файл и шёл по штатной ветке syncEntityFile;
 *  - `blago push` его не подхватывал — он внутри `meetings/`, исключённого через `pull-only-paths`.
 * Это шаг только при наличии meeting-пути (sibling-резолв из <pathOrId>); UUID-режим без файла — пропускаем.
 */
async function persistSiblingAndIndex(
  ctx: AuthenticatedContext,
  resolved: ResolvedTranscription,
  memoText: string,
  remoteUpdatedAtIso: string,
): Promise<{ siblingPath: string } | null> {
  if (!resolved.meetingAbsPath) {
    return null
  }
  const ext = path.extname(resolved.meetingAbsPath)
  const stem = path.basename(resolved.meetingAbsPath, ext)
  const siblingAbs = path.join(path.dirname(resolved.meetingAbsPath), `${stem}.memo.md`)
  const content = memoText.endsWith('\n') ? memoText : `${memoText}\n`
  await fs.mkdir(path.dirname(siblingAbs), { recursive: true })
  await fs.writeFile(siblingAbs, content, 'utf8')

  const rel = path.relative(ctx.root, siblingAbs)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { siblingPath: siblingAbs }
  }
  const index = await loadIndex(ctx.root)
  upsertEntry(index, {
    entity_type: 'call_transcription_memo',
    entity_hash: `${resolved.id}:memo`,
    relative_path: normalizeRelativePath(rel),
    remote_updated_at: remoteUpdatedAtIso,
    content_etag_local: sha256Hex(content),
  })
  await saveIndex(ctx.root, index)
  return { siblingPath: siblingAbs }
}

export async function runUpdateTranscriptionMemo(
  ctx: AuthenticatedContext,
  pathOrId: string,
  options: UpdateTranscriptionMemoOptions,
  cwd: string,
): Promise<UpdateTranscriptionMemoResult> {
  const index = await loadIndex(ctx.root)
  const resolved = resolveTranscription(ctx.root, cwd, pathOrId, index)
  const memo = await readMemoText(cwd, resolved, options)

  const mutationName = Mutations.ChatCoop.UpdateTranscriptionMemo.name
  const response = await ctx.client.Mutation(Mutations.ChatCoop.UpdateTranscriptionMemo.mutation, {
    variables: { data: { id: resolved.id, memo: memo.text } },
  })
  const row = response[mutationName] as { updatedAt?: unknown } | undefined
  if (!row) {
    throw new Error('Сервер вернул пустой ответ на chatcoopUpdateTranscriptionMemo.')
  }

  const remoteUpdatedAtIso = toIso(row.updatedAt, new Date())
  const persisted = await persistSiblingAndIndex(ctx, resolved, memo.text, remoteUpdatedAtIso)

  return {
    transcriptionId: resolved.id,
    memoLength: memo.text.length,
    memoSource: memo.source,
    memoFile: persisted?.siblingPath ?? memo.file,
  }
}
