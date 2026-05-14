// restore: один файл с сервера по пути из индекса (как git checkout -- file из удалённого).

import type { AuthenticatedContext } from '../session/index.js'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { Queries, Zeus } from '@coopenomics/sdk'

import {
  issueToFrontmatterAndBody,
  issueWorkspaceTitlesFromProjects,
  parseBlagoMarkdown,
  projectToFrontmatterAndBody,
  serializeBlagoMarkdown,
  storyToFrontmatterAndBody,
} from '../format/index.js'
import { sha256Hex } from '../lib/hash.js'
import { effectiveParentHash } from '../lib/parent-hash.js'
import { resolveRestoreUserPathToRelativeMarkdown } from './capital-target-expand.js'
import {
  projectCommunicationDayToMarkdown,
  renderCallTranscriptionMarkdown,
  type CommunicationDayLine,
} from './communication-markdown.js'
import {
  findByRelativePath,
  loadIndex,
  loadStaging,
  normalizeRelativePath,
  saveIndex,
  saveStaging,
  upsertEntry,
  type IndexEntry,
  type IndexFile,
} from './index-store.js'
import { formatThrownValue } from '../ui/output.js'
import {
  generateSlug,
  issueFileRelativePath,
  type ProjectPathModel,
  storyFileRelativePath,
  workspaceBasePath,
} from './layout.js'
import { loadProjectMapsFromIndex } from './project-index-map.js'
import { resolveProjectMarkerFromRelativePath } from './resolve-project-hash-from-path.js'
import { writeWorkspaceIndexMarkdown } from './workspace-index.js'

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

interface CapitalIssueRow {
  id?: string | null
  issue_hash: string
  title: string
  description?: string | null
  project_hash: string
  cycle_id?: string | null
  status?: string | null
  priority?: string | null
  estimate?: number | null
  submaster?: string | null
  creators?: string[] | null
  metadata?: unknown
  _created_at?: Date | string | null
  _updated_at?: Date | string | null
}

interface CapitalStoryRow {
  _id?: string | null
  story_hash: string
  title: string
  description?: string | null
  content_format?: string | null
  status?: string | null
  project_hash?: string | null
  issue_hash?: string | null
  _created_at?: Date | string | null
  _updated_at?: Date | string | null
}

function toUpdatedIso(v: Date | string | null | undefined): string {
  if (v === undefined || v === null) {
    return ''
  }
  if (v instanceof Date) {
    return v.toISOString()
  }
  return new Date(v).toISOString()
}

function asProjectPathModel(p: CapitalProjectRow): ProjectPathModel {
  const n = p.id
  const capital_id = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return {
    project_hash: p.project_hash,
    title: p.title ?? '',
    parent_hash: p.parent_hash,
    capital_id,
  }
}

/** Цепочка предков от листа к корню (для путей issue/story). */
async function loadProjectChainFromLeaf(
  ctx: AuthenticatedContext,
  leafHash: string,
  firstFetchParent: string | undefined,
): Promise<Map<string, CapitalProjectRow>> {
  const map = new Map<string, CapitalProjectRow>()
  let hash: string | undefined = leafHash
  let parentArg: string | undefined = firstFetchParent
  for (let i = 0; i < 64 && hash; i++) {
    const parentRef = effectiveParentHash(parentArg)
    const queryResult = await ctx.client.Query(
      Queries.Capital.GetProject.query,
      {
        variables: {
          data: {
            hash,
            parent_hash: parentRef,
          },
        },
      },
    )
    const row = queryResult[Queries.Capital.GetProject.name] as CapitalProjectRow | null | undefined
    if (!row) {
      throw new Error(`Проект «${hash}» не найден на сервере.`)
    }
    map.set(row.project_hash, row)
    const up = effectiveParentHash(row.parent_hash)
    if (!up) {
      break
    }
    hash = up
    parentArg = undefined
  }
  return map
}

function mapsFromProjectRows(rows: Map<string, CapitalProjectRow>): {
  projectByHash: Map<string, ProjectPathModel>
  projectRowByHash: Map<string, CapitalProjectRow>
} {
  const projectByHash = new Map<string, ProjectPathModel>()
  const projectRowByHash = new Map<string, CapitalProjectRow>()
  for (const [h, r] of rows) {
    projectByHash.set(h, asProjectPathModel(r))
    projectRowByHash.set(h, r)
  }
  return { projectByHash, projectRowByHash }
}

async function writeRestoredFile(params: {
  root: string
  index: IndexFile
  entry: IndexEntry
  content: string
  remoteUpdatedAt: string
}): Promise<void> {
  const { root, index, entry, content, remoteUpdatedAt } = params
  const rel = normalizeRelativePath(entry.relative_path)
  const abs = path.join(root, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf8')
  const etag = sha256Hex(await fs.readFile(abs, 'utf8'))
  upsertEntry(index, {
    entity_type: entry.entity_type,
    entity_hash: entry.entity_hash,
    relative_path: rel,
    remote_updated_at: remoteUpdatedAt,
    content_etag_local: etag,
  })
}

async function unstagedPath(root: string, rel: string): Promise<void> {
  const staging = await loadStaging(root)
  const n = normalizeRelativePath(rel)
  const next = staging.paths.filter(p => normalizeRelativePath(p) !== n)
  if (next.length !== staging.paths.length) {
    await saveStaging(root, { paths: next.sort() })
  }
}

async function projectParentHintFromDisk(absFile: string, entityHash: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(absFile, 'utf8')
    const parsed = parseBlagoMarkdown(raw)
    if (parsed.type !== 'project') {
      return undefined
    }
    const h = String(parsed.data.hash ?? '')
    if (h !== entityHash) {
      return undefined
    }
    return effectiveParentHash(
      parsed.data.parent_hash === undefined || parsed.data.parent_hash === null
        ? undefined
        : String(parsed.data.parent_hash),
    )
  }
  catch {
    return undefined
  }
}

export async function runRestore(ctx: AuthenticatedContext, userPath: string): Promise<string> {
  const index = await loadIndex(ctx.root)
  const { projectByHash } = await loadProjectMapsFromIndex(ctx.root, index)
  const rel = await resolveRestoreUserPathToRelativeMarkdown(ctx.root, index, projectByHash, userPath)
  if (!rel || !rel.endsWith('.md')) {
    throw new Error('Укажите путь к .md или id проекта/компонента / составной id задачи (projectId-issueId).')
  }

  const entry = findByRelativePath(index, rel)
  if (!entry) {
    throw new Error(
      `Путь «${rel}» не найден в индексе (.blago/index.json). Выполните «blago pull» или проверьте путь.`,
    )
  }

  if (entry.entity_type === 'project') {
    const abs = path.join(ctx.root, rel)
    const hint = await projectParentHintFromDisk(abs, entry.entity_hash)
    const chain = await loadProjectChainFromLeaf(ctx, entry.entity_hash, hint)
    const row = chain.get(entry.entity_hash)
    if (!row) {
      throw new Error(`Не удалось загрузить проект «${entry.entity_hash}» с сервера.`)
    }
    const { data, body } = projectToFrontmatterAndBody(row)
    const content = serializeBlagoMarkdown(data, body)
    await writeRestoredFile({
      root: ctx.root,
      index,
      entry,
      content,
      remoteUpdatedAt: toUpdatedIso(row._updated_at),
    })
    await saveIndex(ctx.root, index)
    await unstagedPath(ctx.root, rel)
    return rel
  }

  if (entry.entity_type === 'issue') {
    const issueQuery = await ctx.client.Query(
      Queries.Capital.GetIssue.query,
      {
        variables: {
          data: { issue_hash: entry.entity_hash },
        },
      },
    )
    const issueRow = issueQuery[Queries.Capital.GetIssue.name] as CapitalIssueRow | null | undefined
    if (!issueRow) {
      throw new Error(`Задача «${entry.entity_hash}» не найдена на сервере.`)
    }
    const chain = await loadProjectChainFromLeaf(ctx, issueRow.project_hash, undefined)
    const { projectByHash, projectRowByHash } = mapsFromProjectRows(chain)
    const proj = projectByHash.get(issueRow.project_hash)
    if (!proj) {
      throw new Error(`Проект задачи «${issueRow.project_hash}» не найден в цепочке на сервере.`)
    }
    const basePath = workspaceBasePath(proj, projectByHash)
    const issueCapitalId
      = issueRow.id !== undefined && issueRow.id !== null && String(issueRow.id).trim() !== ''
        ? String(issueRow.id)
        : issueRow.issue_hash
    const canonicalRel = issueFileRelativePath(issueRow.title, basePath, issueCapitalId)
    if (normalizeRelativePath(canonicalRel) !== rel) {
      throw new Error(
        `Канонический путь задачи на сервере «${canonicalRel}» не совпадает с «${rel}». Выполните «blago pull» для выравнивания путей.`,
      )
    }
    const workspace = issueWorkspaceTitlesFromProjects(issueRow.project_hash, projectRowByHash)
    const { data, body } = issueToFrontmatterAndBody(issueRow, workspace)
    const content = serializeBlagoMarkdown(data, body)
    await writeRestoredFile({
      root: ctx.root,
      index,
      entry,
      content,
      remoteUpdatedAt: toUpdatedIso(issueRow._updated_at),
    })
    await saveIndex(ctx.root, index)
    await unstagedPath(ctx.root, rel)
    return rel
  }

  if (entry.entity_type === 'story') {
    const storyQuery = await ctx.client.Query(
      Queries.Capital.GetStory.query,
      {
        variables: {
          data: { story_hash: entry.entity_hash },
        },
      },
    )
    const storyRow = storyQuery[Queries.Capital.GetStory.name] as CapitalStoryRow | null | undefined
    if (!storyRow || !storyRow.project_hash) {
      throw new Error(`Требование «${entry.entity_hash}» не найдено на сервере или без project_hash.`)
    }
    const chain = await loadProjectChainFromLeaf(ctx, storyRow.project_hash, undefined)
    const { projectByHash } = mapsFromProjectRows(chain)
    const proj = projectByHash.get(storyRow.project_hash)
    if (!proj) {
      throw new Error(`Проект требования «${storyRow.project_hash}» не найден в цепочке на сервере.`)
    }
    const basePath = workspaceBasePath(proj, projectByHash)
    let issueArg: { id: string, titleSlug: string } | undefined
    if (storyRow.issue_hash) {
      const issueQuery = await ctx.client.Query(
        Queries.Capital.GetIssue.query,
        {
          variables: {
            data: { issue_hash: storyRow.issue_hash },
          },
        },
      )
      const iss = issueQuery[Queries.Capital.GetIssue.name] as CapitalIssueRow | null | undefined
      if (iss) {
        const issueId = iss.id !== undefined && iss.id !== null && String(iss.id).trim() !== '' ? String(iss.id) : iss.issue_hash
        issueArg = {
          id: issueId,
          titleSlug: generateSlug(iss.title) || 'issue',
        }
      }
    }
    const storyRecordId
      = storyRow._id !== undefined && storyRow._id !== null && String(storyRow._id).trim() !== ''
        ? String(storyRow._id)
        : storyRow.story_hash
    const canonicalRel = storyFileRelativePath(
      storyRow.title,
      basePath,
      storyRecordId,
      storyRow.story_hash,
      issueArg,
    )
    if (normalizeRelativePath(canonicalRel) !== rel) {
      throw new Error(
        `Канонический путь требования на сервере «${canonicalRel}» не совпадает с «${rel}». Выполните «blago pull» для выравнивания путей.`,
      )
    }
    const { data, body } = storyToFrontmatterAndBody(storyRow)
    const content = serializeBlagoMarkdown(data, body)
    await writeRestoredFile({
      root: ctx.root,
      index,
      entry,
      content,
      remoteUpdatedAt: toUpdatedIso(storyRow._updated_at),
    })
    await saveIndex(ctx.root, index)
    await unstagedPath(ctx.root, rel)
    return rel
  }

  if (entry.entity_type === 'call_transcription') {
    interface TranscriptionRestorePack {
      transcription: {
        matrixRoomId: string
        roomId: string
        startedAt: Date | string
        endedAt: Date | string | null | undefined
        updatedAt: Date | string
        status: Zeus.TranscriptionStatus
      }
      segments: {
        speakerName: string
        text: string
        startOffset: number
        endOffset: number
      }[]
    }
    const packQ = await ctx.client.Query(Queries.ChatCoop.GetTranscription.query, {
      variables: { data: { id: entry.entity_hash } },
    })
    const pack = packQ[Queries.ChatCoop.GetTranscription.name] as TranscriptionRestorePack | null | undefined
    if (!pack?.transcription) {
      throw new Error(`Транскрипция «${entry.entity_hash}» не найдена на сервере.`)
    }
    const tr = pack.transcription
    if (tr.status !== Zeus.TranscriptionStatus.COMPLETED) {
      throw new Error(`Транскрипция «${entry.entity_hash}» не в статусе COMPLETED — восстановление не поддерживается.`)
    }
    const content = renderCallTranscriptionMarkdown(
      {
        matrixRoomId: tr.matrixRoomId,
        roomId: tr.roomId,
        startedAt: tr.startedAt,
        endedAt: tr.endedAt,
      },
      pack.segments.map(s => ({
        speakerName: s.speakerName,
        text: s.text,
        startOffset: s.startOffset,
        endOffset: s.endOffset,
      })),
    )
    const remoteAt = tr.endedAt !== undefined && tr.endedAt !== null ? toUpdatedIso(tr.endedAt) : toUpdatedIso(tr.updatedAt)
    await writeRestoredFile({
      root: ctx.root,
      index,
      entry,
      content,
      remoteUpdatedAt: remoteAt,
    })
    await saveIndex(ctx.root, index)
    await unstagedPath(ctx.root, rel)
    return rel
  }

  if (entry.entity_type === 'room_message_day') {
    const base = path.basename(rel)
    const dm = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(base)
    if (!dm) {
      throw new Error(`Ожидался файл вида YYYY-MM-DD.md в messages/, получено: «${base}»`)
    }
    const utcDate = dm[1]
    const marker = await resolveProjectMarkerFromRelativePath(ctx.root, rel)
    if (!marker) {
      throw new Error('Не удалось найти project.md / component.md над файлом переписки.')
    }
    interface CommRoomRow {
      matrixRoomId: string
      displayLabel: string
    }
    interface CommLineRow {
      originServerTs: number
      authorLabel: string
      coopUsername: string | null | undefined
      kind: string
      bodyText: string
    }
    const listRoomsKey = Queries.ChatCoop.ListProjectCommunicationRooms.name
    const roomsQ = await ctx.client.Query(Queries.ChatCoop.ListProjectCommunicationRooms.query, {
      variables: { data: { projectHash: marker.hash } },
    })
    const rooms = (roomsQ as Record<string, CommRoomRow[]>)[listRoomsKey] ?? []
    const getMsgKey = Queries.ChatCoop.GetRoomMessagesForUtcDate.name
    const sections = await Promise.all(
      rooms.map(async (room: CommRoomRow) => {
        const mq = await ctx.client.Query(Queries.ChatCoop.GetRoomMessagesForUtcDate.query, {
          variables: { data: { matrixRoomId: room.matrixRoomId, utcDate } },
        })
        const linesRaw = (mq as Record<string, CommLineRow[]>)[getMsgKey] ?? []
        const lines: CommunicationDayLine[] = linesRaw.map((m: CommLineRow) => ({
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
    const content = projectCommunicationDayToMarkdown(marker.title, marker.hash, utcDate, sections)
    await writeRestoredFile({
      root: ctx.root,
      index,
      entry,
      content,
      remoteUpdatedAt: `${utcDate}T23:59:59.999Z`,
    })
    await saveIndex(ctx.root, index)
    await unstagedPath(ctx.root, rel)
    return rel
  }

  throw new Error(`Неизвестный тип сущности в индексе: ${entry.entity_type}`)
}

/** Аргумент `blago restore .` — снять staging и перезаписать каждый путь из индекса содержимым с сервера. */
export const RESTORE_ALL_PATH_SENTINELS = new Set(['.', './'])

export interface RestoreAllFromServerSummary {
  restored: number
  failures: { relativePath: string, message: string }[]
}

/**
 * Полная перезагрузка с сервера по текущему индексу: очистка staging, затем для каждой записи индекса —
 * то же, что «blago restore <путь>» (сервер — источник истины для файла и etag в индексе).
 */
export async function restoreAllFromServer(ctx: AuthenticatedContext): Promise<RestoreAllFromServerSummary> {
  await saveStaging(ctx.root, { paths: [] })
  const index = await loadIndex(ctx.root)
  const sorted = [...index.entries].sort((a, b) =>
    normalizeRelativePath(a.relative_path).localeCompare(normalizeRelativePath(b.relative_path)),
  )
  const failures: { relativePath: string, message: string }[] = []
  let restored = 0
  for (const e of sorted) {
    const rel = normalizeRelativePath(e.relative_path)
    try {
      await runRestore(ctx, rel)
      restored++
    }
    catch (caught: unknown) {
      failures.push({ relativePath: rel, message: formatThrownValue(caught) })
    }
  }
  await writeWorkspaceIndexMarkdown(ctx.root)
  return { restored, failures }
}
