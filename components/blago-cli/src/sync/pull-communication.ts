// Pull `messages/` и `meetings/` по GraphQL ChatCoop (как GitHub-синк секретаря).

import type { AuthenticatedContext } from '../session/index.js'
import type { IndexFile } from './index-store.js'

import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'

import * as path from 'node:path'

import { Queries, Zeus } from '@coopenomics/sdk'

import { sha256Hex } from '../lib/hash.js'
import { mapWithConcurrency } from '../lib/parallel.js'
import { formatThrownValue, warn } from '../ui/output.js'

import {
  loadCommunicationCursors,
  saveCommunicationCursors,
  type CommunicationCursorsFile,
} from './communication-cursors.js'
import {
  projectCommunicationDayToMarkdown,
  renderCallTranscriptionMarkdown,
  transcriptionMeetingFileStemUtc,
  type CommunicationDayLine,
} from './communication-markdown.js'
import { findByHash, normalizeRelativePath, upsertEntry } from './index-store.js'
import { generateSlug, workspaceBasePath, type ProjectPathModel } from './layout.js'
import {
  isNonProjectRoomsCacheFresh,
  isRoomsCacheFresh,
  loadRoomsCache,
  saveRoomsCache,
  type CachedNonProjectRoom,
  type CachedProjectRoom,
  type RoomsCacheFile,
} from './rooms-cache.js'
import { syncEntityFile } from './sync-entity-file.js'

interface ProjectRowLite {
  readonly project_hash: string
  readonly title?: string | null
}

/** Верхняя граница `GetTranscriptionsInput.limit` на контроллере (`@Max(100)`). */
const CHATCOOP_TRANSCRIPTIONS_QUERY_LIMIT = 100

function toUpdatedIso(v: Date | string): string {
  if (v instanceof Date) {
    return v.toISOString()
  }
  return new Date(v).toISOString()
}

function messageDayEntityHash(projectHash: string, utcDate: string): string {
  return createHash('sha256').update(`${projectHash}:${utcDate}`, 'utf8').digest('hex')
}

function transcriptionMemoEntityHash(transcriptionId: string): string {
  return `${transcriptionId.toLowerCase()}:memo`
}

async function readFileIfExists(abs: string): Promise<string | null> {
  try {
    return await fs.readFile(abs, 'utf8')
  }
  catch {
    return null
  }
}

function normalizeMemoContent(memo: string): string {
  if (memo.length === 0) {
    return ''
  }
  return memo.endsWith('\n') ? memo : `${memo}\n`
}

/**
 * Гарантирует наличие файла `meetings/<stem>.memo.md` после pull.
 *
 * Файл создаётся **всегда** (даже если на сервере memo пуст), чтобы пользователь мог редактировать
 * sibling «в одно касание», а команда `blago transcription memo` всегда находила его. Конфликты с
 * локальными правками разруливаются:
 *
 *  - индекс есть → штатный `syncEntityFile` (он умеет merge-markers «<<<<<<< blago/local …»);
 *  - индекса нет, файла нет → пишем серверный memo и индексируем (baseline = сервер);
 *  - индекса нет, файл есть, содержимое совпадает с сервером → просто индексируем (baseline = совпавший контент);
 *  - индекса нет, файл есть, серверный memo пустой → оставляем локальный черновик и индексируем его (baseline = локальный);
 *  - индекса нет, файл есть, оба непустые и различаются → пишем merge-markers, индексируем merged.
 */
async function syncTranscriptionMemoFile(params: {
  root: string
  index: IndexFile
  transcriptionId: string
  relativePath: string
  serverMemo: string
  remoteUpdatedAtIso: string
}): Promise<void> {
  const { root, index, transcriptionId, relativePath, serverMemo, remoteUpdatedAtIso } = params
  const rel = normalizeRelativePath(relativePath)
  const abs = path.join(root, rel)
  const entityHash = transcriptionMemoEntityHash(transcriptionId)
  const serverContent = normalizeMemoContent(serverMemo)
  const prev = findByHash(index, 'call_transcription_memo', entityHash)

  if (prev) {
    await syncEntityFile({
      root,
      index,
      entityType: 'call_transcription_memo',
      entityHash,
      relativePath: rel,
      content: serverContent,
      remoteUpdatedAt: remoteUpdatedAtIso,
      label: `memo транскрипции ${transcriptionId}`,
    })
    return
  }

  await fs.mkdir(path.dirname(abs), { recursive: true })
  const local = await readFileIfExists(abs)

  if (local === null) {
    await fs.writeFile(abs, serverContent, 'utf8')
    upsertEntry(index, {
      entity_type: 'call_transcription_memo',
      entity_hash: entityHash,
      relative_path: rel,
      remote_updated_at: remoteUpdatedAtIso,
      content_etag_local: sha256Hex(serverContent),
    })
    return
  }

  if (local === serverContent) {
    upsertEntry(index, {
      entity_type: 'call_transcription_memo',
      entity_hash: entityHash,
      relative_path: rel,
      remote_updated_at: remoteUpdatedAtIso,
      content_etag_local: sha256Hex(local),
    })
    return
  }

  if (serverContent.trim().length === 0) {
    // Сервер ничего не знает — берём локальный черновик как baseline. Опубликовать его можно
    // через `blago transcription memo <meeting-path>`.
    upsertEntry(index, {
      entity_type: 'call_transcription_memo',
      entity_hash: entityHash,
      relative_path: rel,
      remote_updated_at: remoteUpdatedAtIso,
      content_etag_local: sha256Hex(local),
    })
    return
  }

  const merged = `<<<<<<< blago/local\n${local}\n=======\n${serverContent}\n>>>>>>> blago/remote\n`
  await fs.writeFile(abs, merged, 'utf8')
  upsertEntry(index, {
    entity_type: 'call_transcription_memo',
    entity_hash: entityHash,
    relative_path: rel,
    remote_updated_at: remoteUpdatedAtIso,
    content_etag_local: sha256Hex(merged),
  })
  warn(
    `Конфликт memo транскрипции ${transcriptionId}: локальный черновик и серверная версия различаются. В «${rel}» записаны маркеры слияния («<<<<<<< blago/local» … «>>>>>>> blago/remote»). Оставьте одну версию текста и опубликуйте через «blago transcription memo».`,
  )
}

function dateFromUnknown(value: unknown): Date | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

async function listRooms(ctx: AuthenticatedContext, projectHash: string) {
  const q = await ctx.client.Query(Queries.ChatCoop.ListProjectCommunicationRooms.query, {
    variables: { data: { projectHash } },
  })
  return q[Queries.ChatCoop.ListProjectCommunicationRooms.name] ?? []
}

/** Стабильная папка непроектной комнаты в `rooms/`. Системные — фиксированные, комнаты секретаря — slug + хвост id (уникальность). */
function nonProjectRoomFolder(kind: string, matrixRoomId: string, displayLabel: string): string {
  if (kind === 'MEMBERS') {
    return 'komnata-paishchikov'
  }
  if (kind === 'COUNCIL') {
    return 'komnata-soveta'
  }
  const slug = generateSlug(displayLabel) || 'komnata'
  const shortId = createHash('sha256').update(matrixRoomId, 'utf8').digest('hex').slice(0, 6)
  return `${slug}-${shortId}`
}

export interface PullCommunicationOptions {
  /** Перечитать карту комнат с сервера, не дожидаясь истечения суточного кэша. */
  readonly refreshRooms?: boolean
}

/**
 * Карта комнат проектов: из кэша, если он свежий, иначе обход сервера параллельно по проектам.
 * Набор комнат меняется редко, а запрос на каждый проект — половина всех обращений при pull.
 */
async function resolveProjectRooms(
  ctx: AuthenticatedContext,
  projects: readonly ProjectRowLite[],
  options: PullCommunicationOptions,
): Promise<Map<string, CachedProjectRoom[]>> {
  const cache = await loadRoomsCache(ctx.root)
  const hashes = projects.map(p => p.project_hash)
  const cacheUsable
    = options.refreshRooms !== true
      && isRoomsCacheFresh(cache)
      && hashes.every(hash => cache.projectRooms[hash] !== undefined)

  if (cacheUsable) {
    const fromCache = new Map<string, CachedProjectRoom[]>()
    for (const hash of hashes) {
      fromCache.set(hash, cache.projectRooms[hash] ?? [])
    }
    return fromCache
  }

  const fetched = await mapWithConcurrency(hashes, async (hash) => {
    try {
      const rooms = await listRooms(ctx, hash)
      return rooms.map(r => ({ matrixRoomId: r.matrixRoomId, displayLabel: r.displayLabel }))
    }
    catch (e) {
      warn(`Список комнат переписки, проект ${hash}: ${formatThrownValue(e)}`)
      return null
    }
  })

  const result = new Map<string, CachedProjectRoom[]>()
  const projectRooms: Record<string, CachedProjectRoom[]> = { ...cache.projectRooms }
  let allResolved = true
  for (const [i, hash] of hashes.entries()) {
    const rooms = fetched[i]
    if (rooms === null) {
      // Не спросили — берём прошлое значение, чтобы разовый сбой не выглядел как «комнат нет».
      allResolved = false
      result.set(hash, cache.projectRooms[hash] ?? [])
      continue
    }
    result.set(hash, rooms)
    projectRooms[hash] = rooms
  }

  try {
    await saveRoomsCache(ctx.root, {
      // Отметку свежести ставим только при полном обходе: иначе кэш «застынет» с дырами.
      refreshedAt: allResolved ? new Date().toISOString() : cache.refreshedAt,
      projectRooms,
      nonProjectRefreshedAt: cache.nonProjectRefreshedAt,
      nonProjectRooms: cache.nonProjectRooms,
    })
  }
  catch (e) {
    warn(`Не удалось сохранить кэш комнат: ${formatThrownValue(e)}`)
  }
  return result
}

export async function pullProjectCommunicationArtifacts(
  ctx: AuthenticatedContext,
  index: IndexFile,
  projects: readonly ProjectRowLite[],
  projectByHash: ReadonlyMap<string, ProjectPathModel>,
  options: PullCommunicationOptions = {},
): Promise<void> {
  let cursors: CommunicationCursorsFile
  try {
    cursors = await loadCommunicationCursors(ctx.root)
  }
  catch (e) {
    warn(`Курсоры переписки: не удалось прочитать, начинаем с пустых: ${formatThrownValue(e)}`)
    cursors = {
      messageLastTsByRoom: {},
      transcriptionLastEndedExclusiveByProject: {},
      transcriptionLastEndedExclusiveByRoom: {},
    }
  }

  const roomsByProject = await resolveProjectRooms(ctx, projects, options)

  for (const row of projects) {
    const projModel = projectByHash.get(row.project_hash)
    if (!projModel) {
      continue
    }

    const rooms = roomsByProject.get(row.project_hash) ?? []
    if (rooms.length === 0) {
      continue
    }

    const basePath = workspaceBasePath(projModel, projectByHash)
    const projectTitle = row.title ?? 'unnamed'
    const matrixIds = rooms.map(r => r.matrixRoomId)

    try {
      const datesToRefresh = new Set<string>()

      // Курсора нет → after=0 (все origin_server_ts > 0). Иначе как в GitHub-синке: только новее last.
      const datesPerRoom = await mapWithConcurrency(rooms, async (room) => {
        const last = cursors.messageLastTsByRoom[room.matrixRoomId]
        const afterTs = last ?? 0
        const datesQ = await ctx.client.Query(Queries.ChatCoop.ListUtcDatesWithNewRoomMessages.query, {
          variables: {
            data: {
              matrixRoomId: room.matrixRoomId,
              afterOriginServerTsExclusive: afterTs,
            },
          },
        })
        return datesQ[Queries.ChatCoop.ListUtcDatesWithNewRoomMessages.name] ?? []
      })
      for (const dates of datesPerRoom) {
        for (const d of dates) {
          datesToRefresh.add(d)
        }
      }

      const sortedDates = [...datesToRefresh].sort()
      for (const utcDate of sortedDates) {
        const sections = await Promise.all(
          rooms.map(async (room) => {
            const mq = await ctx.client.Query(Queries.ChatCoop.GetRoomMessagesForUtcDate.query, {
              variables: { data: { matrixRoomId: room.matrixRoomId, utcDate } },
            })
            const linesRaw = mq[Queries.ChatCoop.GetRoomMessagesForUtcDate.name] ?? []
            const lines: CommunicationDayLine[] = linesRaw.map(m => ({
              originServerTs: m.originServerTs,
              authorLabel: m.authorLabel,
              coopUsername: m.coopUsername,
              kind: String(m.kind),
              bodyText: m.bodyText,
            }))
            return {
              displayLabel: room.displayLabel,
              matrixRoomId: room.matrixRoomId,
              lines,
            }
          }),
        )
        const hasAny = sections.some(s => s.lines.length > 0)
        if (!hasAny) {
          continue
        }
        const content = projectCommunicationDayToMarkdown(projectTitle, row.project_hash, utcDate, sections)
        const rel = `${basePath}/messages/${utcDate}.md`
        const entityHash = messageDayEntityHash(row.project_hash, utcDate)
        await syncEntityFile({
          root: ctx.root,
          index,
          entityType: 'room_message_day',
          entityHash,
          relativePath: rel,
          content,
          remoteUpdatedAt: `${utcDate}T23:59:59.999Z`,
          label: `переписка ${utcDate} (${row.project_hash})`,
        })
      }

      // Курсор двигаем только у комнат, где были новые сутки: если нового нет, метка и так
      // на месте, а запрос за максимумом — чистая трата обращения к серверу на каждый pull.
      const roomsToAdvance = rooms.filter((_, i) => (datesPerRoom[i] ?? []).length > 0)
      const maxTsPerRoom = await mapWithConcurrency(roomsToAdvance, async (room) => {
        const maxQ = await ctx.client.Query(Queries.ChatCoop.GetMaxOriginServerTsForRoom.query, {
          variables: { data: { matrixRoomId: room.matrixRoomId } },
        })
        return maxQ[Queries.ChatCoop.GetMaxOriginServerTsForRoom.name] as number | null | undefined
      })
      for (const [i, room] of roomsToAdvance.entries()) {
        const maxTs = maxTsPerRoom[i]
        if (maxTs !== undefined && maxTs !== null && Number.isFinite(maxTs)) {
          cursors.messageLastTsByRoom[room.matrixRoomId] = maxTs
        }
      }
    }
    catch (e) {
      warn(`Переписка Matrix, проект ${row.project_hash} (${projectTitle}): ${formatThrownValue(e)}`)
    }

    try {
      const tKey = row.project_hash
      const tExIso = cursors.transcriptionLastEndedExclusiveByProject[tKey]
      // Курсор `transcriptionLastEndedExclusiveByProject` влияет ТОЛЬКО на скачивание meeting.md
      // (тяжёлый GetTranscription с сегментами). Sibling-файл `.memo.md` синхронизируется для всех
      // COMPLETED-транскрипций каждый pull — поле `memo` приходит в лёгком GetTranscriptions.
      const lowerBoundExclusive = tExIso === undefined ? new Date(0) : new Date(tExIso)

      interface TranscriptionCandidate {
        id: string
        endedAt: Date
        memo: string
        updatedAt: Date | undefined
      }
      const byId = new Map<string, TranscriptionCandidate>()
      const listsPerRoom = await mapWithConcurrency(matrixIds, async (roomId) => {
        const tq = await ctx.client.Query(Queries.ChatCoop.GetTranscriptions.query, {
          variables: { data: { matrixRoomId: roomId, limit: CHATCOOP_TRANSCRIPTIONS_QUERY_LIMIT, offset: 0 } },
        })
        return tq[Queries.ChatCoop.GetTranscriptions.name] ?? []
      })
      for (const list of listsPerRoom) {
        for (const t of list) {
          const end = dateFromUnknown(t.endedAt)
          if (t.status !== Zeus.TranscriptionStatus.COMPLETED || !end) {
            continue
          }
          const prev = byId.get(t.id)
          if (!prev || end > prev.endedAt) {
            byId.set(t.id, {
              id: t.id,
              endedAt: end,
              memo: typeof t.memo === 'string' ? t.memo : '',
              updatedAt: dateFromUnknown(t.updatedAt),
            })
          }
        }
      }
      const allCompleted = [...byId.values()].sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime())

      // 1) meeting.md — только новые после курсора (тяжёлый GetTranscription с сегментами).
      const newMeetings = allCompleted.filter(c => c.endedAt.getTime() > lowerBoundExclusive.getTime())
      let maxEnded: Date | null = null
      for (const c of newMeetings) {
        const packQ = await ctx.client.Query(Queries.ChatCoop.GetTranscription.query, {
          variables: { data: { id: c.id } },
        })
        const pack = packQ[Queries.ChatCoop.GetTranscription.name]
        if (!pack?.transcription || pack.transcription.status !== Zeus.TranscriptionStatus.COMPLETED) {
          continue
        }
        const tr = pack.transcription
        const startedAt: Date | string = dateFromUnknown(tr.startedAt) ?? (tr.startedAt as Date | string)
        const endedAtTr: Date | string | null | undefined
          = dateFromUnknown(tr.endedAt) ?? (tr.endedAt as Date | string | null | undefined)
        const md = renderCallTranscriptionMarkdown(
          {
            roomId: String(tr.roomId),
            startedAt,
            endedAt: endedAtTr,
          },
          pack.segments.map(s => ({
            speakerName: s.speakerName,
            text: s.text,
            startOffset: s.startOffset,
            endOffset: s.endOffset,
          })),
        )
        const stem = transcriptionMeetingFileStemUtc(c.endedAt)
        const rel = `${basePath}/meetings/${stem}.md`
        const entityHash = c.id.toLowerCase()
        await syncEntityFile({
          root: ctx.root,
          index,
          entityType: 'call_transcription',
          entityHash,
          relativePath: rel,
          content: md,
          remoteUpdatedAt: toUpdatedIso(c.endedAt),
          label: `транскрипция ${c.id}`,
        })

        if (!maxEnded || c.endedAt > maxEnded) {
          maxEnded = c.endedAt
        }
      }

      // 2) sibling .memo.md — для ВСЕХ COMPLETED-транскрипций (бэкфил независимо от курсора).
      //    Поле tr.memo пришло в лёгком GetTranscriptions, повторных запросов не делаем.
      for (const c of allCompleted) {
        const stem = transcriptionMeetingFileStemUtc(c.endedAt)
        const memoRel = `${basePath}/meetings/${stem}.memo.md`
        const memoRemoteUpdatedAt = toUpdatedIso(c.updatedAt ?? c.endedAt)
        await syncTranscriptionMemoFile({
          root: ctx.root,
          index,
          transcriptionId: c.id,
          relativePath: memoRel,
          serverMemo: c.memo,
          remoteUpdatedAtIso: memoRemoteUpdatedAt,
        })
      }

      if (maxEnded) {
        cursors.transcriptionLastEndedExclusiveByProject[tKey] = maxEnded.toISOString()
      }
      else if (tExIso === undefined) {
        cursors.transcriptionLastEndedExclusiveByProject[tKey] = new Date().toISOString()
      }
    }
    catch (e) {
      warn(`Транскрипции звонков, проект ${row.project_hash}: ${formatThrownValue(e)}`)
    }
  }

  try {
    await saveCommunicationCursors(ctx.root, cursors)
  }
  catch (e) {
    warn(`Не удалось сохранить курсоры переписки: ${formatThrownValue(e)}`)
  }
}

/** Сохранить непроектные комнаты в кэш, не трогая уже собранную карту проектов. */
async function persistNonProjectRooms(
  root: string,
  cache: RoomsCacheFile,
  rooms: CachedNonProjectRoom[],
): Promise<void> {
  try {
    const current = await loadRoomsCache(root)
    await saveRoomsCache(root, {
      refreshedAt: current.refreshedAt || cache.refreshedAt,
      projectRooms: current.projectRooms,
      nonProjectRefreshedAt: new Date().toISOString(),
      nonProjectRooms: rooms,
    })
  }
  catch (e) {
    warn(`Не удалось сохранить кэш непроектных комнат: ${formatThrownValue(e)}`)
  }
}

/**
 * Pull переписки и транскрипций из комнат ВНЕ проектов Capital (пайщики, совет, комнаты секретаря).
 * Раскладка — отдельная верхняя папка `rooms/<folder>/{messages,meetings}/`, чтобы не смешивать с
 * проектными `meetings/`. Логика идентична проектной, но bucket = одна комната, курсор транскрипций — по matrixRoomId.
 */
export async function pullNonProjectCommunicationArtifacts(
  ctx: AuthenticatedContext,
  index: IndexFile,
  options: PullCommunicationOptions = {},
): Promise<void> {
  const roomsCache = await loadRoomsCache(ctx.root)
  let rooms: CachedNonProjectRoom[]
  if (options.refreshRooms !== true && isNonProjectRoomsCacheFresh(roomsCache)) {
    rooms = roomsCache.nonProjectRooms
  }
  else {
    try {
      const q = await ctx.client.Query(Queries.ChatCoop.ListNonProjectCommunicationRooms.query, {})
      const fetched = (q[Queries.ChatCoop.ListNonProjectCommunicationRooms.name] ?? []) as CachedNonProjectRoom[]
      rooms = fetched.map(r => ({
        matrixRoomId: r.matrixRoomId,
        displayLabel: r.displayLabel,
        kind: String(r.kind),
      }))
      await persistNonProjectRooms(ctx.root, roomsCache, rooms)
    }
    catch (e) {
      warn(`Список непроектных комнат (chatcoopListNonProjectCommunicationRooms): ${formatThrownValue(e)}`)
      return
    }
  }
  if (rooms.length === 0) {
    return
  }

  let cursors: CommunicationCursorsFile
  try {
    cursors = await loadCommunicationCursors(ctx.root)
  }
  catch (e) {
    warn(`Курсоры переписки (комнаты): не удалось прочитать, начинаем с пустых: ${formatThrownValue(e)}`)
    cursors = {
      messageLastTsByRoom: {},
      transcriptionLastEndedExclusiveByProject: {},
      transcriptionLastEndedExclusiveByRoom: {},
    }
  }

  for (const room of rooms) {
    const folder = nonProjectRoomFolder(room.kind, room.matrixRoomId, room.displayLabel)
    const basePath = `rooms/${folder}`
    const roomTitle = room.displayLabel || room.matrixRoomId

    // Сообщения комнаты — по календарным суткам UTC новее курсора.
    try {
      const last = cursors.messageLastTsByRoom[room.matrixRoomId]
      const afterTs = last ?? 0
      const datesQ = await ctx.client.Query(Queries.ChatCoop.ListUtcDatesWithNewRoomMessages.query, {
        variables: { data: { matrixRoomId: room.matrixRoomId, afterOriginServerTsExclusive: afterTs } },
      })
      const dates = (datesQ[Queries.ChatCoop.ListUtcDatesWithNewRoomMessages.name] ?? []).sort()
      for (const utcDate of dates) {
        const mq = await ctx.client.Query(Queries.ChatCoop.GetRoomMessagesForUtcDate.query, {
          variables: { data: { matrixRoomId: room.matrixRoomId, utcDate } },
        })
        const linesRaw = mq[Queries.ChatCoop.GetRoomMessagesForUtcDate.name] ?? []
        const lines: CommunicationDayLine[] = linesRaw.map(m => ({
          originServerTs: m.originServerTs,
          authorLabel: m.authorLabel,
          coopUsername: m.coopUsername,
          kind: String(m.kind),
          bodyText: m.bodyText,
        }))
        if (lines.length === 0) {
          continue
        }
        const content = projectCommunicationDayToMarkdown(roomTitle, room.matrixRoomId, utcDate, [
          { displayLabel: room.displayLabel, matrixRoomId: room.matrixRoomId, lines },
        ])
        const rel = `${basePath}/messages/${utcDate}.md`
        const entityHash = messageDayEntityHash(room.matrixRoomId, utcDate)
        await syncEntityFile({
          root: ctx.root,
          index,
          entityType: 'room_message_day',
          entityHash,
          relativePath: rel,
          content,
          remoteUpdatedAt: `${utcDate}T23:59:59.999Z`,
          label: `переписка ${utcDate} (${room.matrixRoomId})`,
        })
      }

      // Курсор двигаем только если были новые сутки: иначе запрос за максимумом ничего не меняет.
      if (dates.length > 0) {
        const maxQ = await ctx.client.Query(Queries.ChatCoop.GetMaxOriginServerTsForRoom.query, {
          variables: { data: { matrixRoomId: room.matrixRoomId } },
        })
        const maxTs = maxQ[Queries.ChatCoop.GetMaxOriginServerTsForRoom.name] as number | null | undefined
        if (maxTs !== undefined && maxTs !== null && Number.isFinite(maxTs)) {
          cursors.messageLastTsByRoom[room.matrixRoomId] = maxTs
        }
      }
    }
    catch (e) {
      warn(`Переписка Matrix, комната ${room.matrixRoomId} (${roomTitle}): ${formatThrownValue(e)}`)
    }

    // Транскрипции звонков комнаты + sibling memo.
    try {
      const tExIso = cursors.transcriptionLastEndedExclusiveByRoom[room.matrixRoomId]
      const lowerBoundExclusive = tExIso === undefined ? new Date(0) : new Date(tExIso)

      interface TranscriptionCandidate {
        id: string
        endedAt: Date
        memo: string
        updatedAt: Date | undefined
      }
      const byId = new Map<string, TranscriptionCandidate>()
      const tq = await ctx.client.Query(Queries.ChatCoop.GetTranscriptions.query, {
        variables: { data: { matrixRoomId: room.matrixRoomId, limit: CHATCOOP_TRANSCRIPTIONS_QUERY_LIMIT, offset: 0 } },
      })
      const list = tq[Queries.ChatCoop.GetTranscriptions.name] ?? []
      for (const t of list) {
        const end = dateFromUnknown(t.endedAt)
        if (t.status !== Zeus.TranscriptionStatus.COMPLETED || !end) {
          continue
        }
        const prev = byId.get(t.id)
        if (!prev || end > prev.endedAt) {
          byId.set(t.id, {
            id: t.id,
            endedAt: end,
            memo: typeof t.memo === 'string' ? t.memo : '',
            updatedAt: dateFromUnknown(t.updatedAt),
          })
        }
      }
      const allCompleted = [...byId.values()].sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime())

      const newMeetings = allCompleted.filter(c => c.endedAt.getTime() > lowerBoundExclusive.getTime())
      let maxEnded: Date | null = null
      for (const c of newMeetings) {
        const packQ = await ctx.client.Query(Queries.ChatCoop.GetTranscription.query, {
          variables: { data: { id: c.id } },
        })
        const pack = packQ[Queries.ChatCoop.GetTranscription.name]
        if (!pack?.transcription || pack.transcription.status !== Zeus.TranscriptionStatus.COMPLETED) {
          continue
        }
        const tr = pack.transcription
        const startedAt: Date | string = dateFromUnknown(tr.startedAt) ?? (tr.startedAt as Date | string)
        const endedAtTr: Date | string | null | undefined
          = dateFromUnknown(tr.endedAt) ?? (tr.endedAt as Date | string | null | undefined)
        const md = renderCallTranscriptionMarkdown(
          {
            roomId: String(tr.roomId),
            startedAt,
            endedAt: endedAtTr,
          },
          pack.segments.map(s => ({
            speakerName: s.speakerName,
            text: s.text,
            startOffset: s.startOffset,
            endOffset: s.endOffset,
          })),
        )
        const stem = transcriptionMeetingFileStemUtc(c.endedAt)
        const rel = `${basePath}/meetings/${stem}.md`
        const entityHash = c.id.toLowerCase()
        await syncEntityFile({
          root: ctx.root,
          index,
          entityType: 'call_transcription',
          entityHash,
          relativePath: rel,
          content: md,
          remoteUpdatedAt: toUpdatedIso(c.endedAt),
          label: `транскрипция ${c.id}`,
        })
        if (!maxEnded || c.endedAt > maxEnded) {
          maxEnded = c.endedAt
        }
      }

      for (const c of allCompleted) {
        const stem = transcriptionMeetingFileStemUtc(c.endedAt)
        const memoRel = `${basePath}/meetings/${stem}.memo.md`
        const memoRemoteUpdatedAt = toUpdatedIso(c.updatedAt ?? c.endedAt)
        await syncTranscriptionMemoFile({
          root: ctx.root,
          index,
          transcriptionId: c.id,
          relativePath: memoRel,
          serverMemo: c.memo,
          remoteUpdatedAtIso: memoRemoteUpdatedAt,
        })
      }

      if (maxEnded) {
        cursors.transcriptionLastEndedExclusiveByRoom[room.matrixRoomId] = maxEnded.toISOString()
      }
      else if (tExIso === undefined) {
        cursors.transcriptionLastEndedExclusiveByRoom[room.matrixRoomId] = new Date().toISOString()
      }
    }
    catch (e) {
      warn(`Транскрипции звонков, комната ${room.matrixRoomId}: ${formatThrownValue(e)}`)
    }
  }

  try {
    await saveCommunicationCursors(ctx.root, cursors)
  }
  catch (e) {
    warn(`Не удалось сохранить курсоры переписки (комнаты): ${formatThrownValue(e)}`)
  }
}
