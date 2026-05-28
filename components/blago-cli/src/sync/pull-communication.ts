// Pull `messages/` и `meetings/` по GraphQL ChatCoop (как GitHub-синк секретаря).

import type { AuthenticatedContext } from '../session/index.js'
import type { IndexFile } from './index-store.js'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { createHash } from 'node:crypto'

import { Queries, Zeus } from '@coopenomics/sdk'

import { sha256Hex } from '../lib/hash.js'
import { formatThrownValue, warn } from '../ui/output.js'
import { findByHash, normalizeRelativePath, upsertEntry } from './index-store.js'

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
import { workspaceBasePath, type ProjectPathModel } from './layout.js'
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

export async function pullProjectCommunicationArtifacts(
  ctx: AuthenticatedContext,
  index: IndexFile,
  projects: readonly ProjectRowLite[],
  projectByHash: ReadonlyMap<string, ProjectPathModel>,
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
    }
  }

  for (const row of projects) {
    const projModel = projectByHash.get(row.project_hash)
    if (!projModel) {
      continue
    }

    let rooms: Awaited<ReturnType<typeof listRooms>>
    try {
      rooms = await listRooms(ctx, row.project_hash)
    }
    catch (e) {
      warn(
        `Список комнат переписки (chatcoopListProjectCommunicationRooms), проект ${row.project_hash}: ${formatThrownValue(e)}`,
      )
      continue
    }
    if (rooms.length === 0) {
      continue
    }

    const basePath = workspaceBasePath(projModel, projectByHash)
    const projectTitle = row.title ?? 'unnamed'
    const matrixIds = rooms.map(r => r.matrixRoomId)

    try {
      const datesToRefresh = new Set<string>()

      // Курсора нет → after=0 (все origin_server_ts > 0). Иначе как в GitHub-синке: только новее last.
      for (const room of rooms) {
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
        const dates = datesQ[Queries.ChatCoop.ListUtcDatesWithNewRoomMessages.name] ?? []
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

      for (const room of rooms) {
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
      for (const roomId of matrixIds) {
        const tq = await ctx.client.Query(Queries.ChatCoop.GetTranscriptions.query, {
          variables: { data: { matrixRoomId: roomId, limit: CHATCOOP_TRANSCRIPTIONS_QUERY_LIMIT, offset: 0 } },
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
            matrixRoomId: String(tr.matrixRoomId),
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
