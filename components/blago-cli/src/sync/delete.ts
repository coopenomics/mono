// delete: удалить issue/story на сервере (DeleteIssue/DeleteStory) + локально (файл, index, staging, pending-create).

import type { AuthenticatedContext } from '../session/index.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { Mutations } from '@coopenomics/sdk'
import { parseBlagoMarkdown } from '../format/index.js'
import { sha256Hex } from '../lib/hash.js'
import { resolveRestoreUserPathToRelativeMarkdown } from './capital-target-expand.js'
import {
  findByRelativePath,
  type IndexEntry,
  type IndexFile,
  loadIndex,
  loadStaging,
  normalizeRelativePath,
  saveIndex,
  saveStaging,
} from './index-store.js'
import {
  loadPendingCreate,
  pendingKindForEntityType,
  removePendingItem,
} from './pending-create.js'
import { loadProjectMapsFromIndex } from './project-index-map.js'
import { refreshParentProjectVersion } from './refresh-parent.js'
import { writeWorkspaceIndexMarkdown } from './workspace-index.js'

export type BlagoDeleteKind = 'issue' | 'story'

export interface RunDeleteOptions {
  readonly force?: boolean
}

export interface RunDeleteResult {
  readonly relativePath: string
  readonly entityHash: string
  readonly remoteDeleted: boolean
  readonly pendingOnly: boolean
}

export async function runDelete(
  ctx: AuthenticatedContext,
  kind: BlagoDeleteKind,
  target: string,
  options: RunDeleteOptions = {},
): Promise<RunDeleteResult> {
  const root = ctx.root
  const index = await loadIndex(root)
  const rel = await resolveTarget(root, index, target)
  if (!rel.endsWith('.md')) {
    throw new Error('Укажите путь к .md, frontmatter id или projectId-issueId.')
  }

  const entry = findByRelativePath(index, rel)
  const pendingKind = pendingKindForEntityType(kind)
  const pendingData = pendingKind ? await loadPendingCreate(root) : null
  const pending = pendingData
    ? pendingData.items.find(
      i => i.kind === pendingKind && normalizeRelativePath(i.relative_path) === rel,
    ) ?? null
    : null

  if (!entry && !pending) {
    throw new Error(
      `Не найдено в индексе и pending-create: ${rel}. Выполните «blago pull» или проверьте путь/id.`,
    )
  }
  if (entry && pending) {
    throw new Error(
      `Несогласованное состояние: ${rel} и в индексе, и в pending-create. Удалите вручную pending-create.json или выполните pull.`,
    )
  }
  if (entry && entry.entity_type !== kind) {
    throw new Error(
      `Путь «${rel}» относится к ${entry.entity_type}, не ${kind}. Для этого типа команда не поддерживается.`,
    )
  }

  const abs = path.join(root, rel)
  let fileContent: string | null = null
  try {
    fileContent = await fs.readFile(abs, 'utf8')
  }
  catch {
    fileContent = null
  }

  const staging = await loadStaging(root)
  const isStaged = staging.paths.some(p => normalizeRelativePath(p) === rel)
  const isDirty = Boolean(
    entry && fileContent !== null && sha256Hex(fileContent) !== entry.content_etag_local,
  )
  if ((isDirty || isStaged) && options.force !== true) {
    const reasons: string[] = []
    if (isDirty) {
      reasons.push('локальные изменения не сохранены (отличаются от индекса)')
    }
    if (isStaged) {
      reasons.push('файл в staging (blago add)')
    }
    throw new Error(
      `Удаление отклонено (${reasons.join('; ')}): ${rel}. Укажите --force для принудительного удаления.`,
    )
  }

  let entityHash = entry?.entity_hash ?? pending?.entity_hash ?? ''
  let parentProjectHash: string | undefined
  if (fileContent !== null) {
    try {
      const parsed = parseBlagoMarkdown(fileContent)
      if (!entityHash) {
        entityHash = String(parsed.data.hash ?? '').trim()
      }
      const ph = parsed.data.project_hash
      if (ph !== undefined && ph !== null) {
        const t = String(ph).trim()
        if (t !== '') {
          parentProjectHash = t
        }
      }
    }
    catch {
      // ignore
    }
  }
  if (!entityHash) {
    throw new Error(`Не удалось определить hash сущности для ${rel}.`)
  }

  let remoteDeleted = false
  const pendingOnly = Boolean(pending && !entry)
  if (!pendingOnly) {
    if (kind === 'issue') {
      await ctx.client.Mutation(Mutations.Capital.DeleteIssue.mutation, {
        variables: { data: { issue_hash: entityHash } },
      })
    }
    else {
      await ctx.client.Mutation(Mutations.Capital.DeleteStory.mutation, {
        variables: { data: { story_hash: entityHash } },
      })
    }
    remoteDeleted = true
  }

  if (fileContent !== null) {
    try {
      await fs.unlink(abs)
    }
    catch {
      // ignore — файл может уже отсутствовать
    }
  }

  if (entry) {
    const nextEntries = index.entries.filter(
      e => !(e.entity_type === entry.entity_type && e.entity_hash === entry.entity_hash),
    )
    const indexAfter: IndexFile = { entries: nextEntries }
    if (remoteDeleted && parentProjectHash) {
      const projEntryAfter = indexAfter.entries.find(
        e => e.entity_type === 'project' && e.entity_hash === parentProjectHash,
      )
      let parentHashHint: string | null | undefined
      if (projEntryAfter) {
        try {
          const pAbs = path.join(root, projEntryAfter.relative_path)
          const pRaw = await fs.readFile(pAbs, 'utf8')
          const pParsed = parseBlagoMarkdown(pRaw)
          const v = pParsed.data.parent_hash
          parentHashHint = v === undefined || v === null ? undefined : String(v)
        }
        catch {
          parentHashHint = undefined
        }
      }
      await refreshParentProjectVersion(ctx, indexAfter, parentProjectHash, parentHashHint)
    }
    await saveIndex(root, indexAfter)
  }

  if (isStaged) {
    const nextPaths = staging.paths.filter(p => normalizeRelativePath(p) !== rel)
    await saveStaging(root, { paths: nextPaths })
  }

  if (pending && pendingKind) {
    try {
      await removePendingItem(root, pendingKind, pending.entity_hash)
    }
    catch {
      // ignore — возможная гонка или уже удалено
    }
  }

  await writeWorkspaceIndexMarkdown(root)

  return { relativePath: rel, entityHash, remoteDeleted, pendingOnly }
}

async function resolveTarget(
  root: string,
  index: IndexFile,
  target: string,
): Promise<string> {
  const t = target.trim()
  if (t === '') {
    throw new Error('Не указан путь / id сущности для удаления.')
  }
  const { projectByHash } = await loadProjectMapsFromIndex(root, index)
  return resolveRestoreUserPathToRelativeMarkdown(root, index, projectByHash, t)
}

/** Данные о серверных hash-ах для orphan detection при pull. */
export interface ServerHashSets {
  readonly projectHashes: ReadonlySet<string>
  readonly issueHashes: ReadonlySet<string>
  readonly storyHashes: ReadonlySet<string>
}

export interface OrphanEntry {
  readonly entry: IndexEntry
  readonly reason: 'file-missing' | 'deleted-on-server'
}

/**
 * Найти записи индекса (project/issue/story), которых нет на сервере в выборке текущего pull.
 * Фильтрует по scope: issue/story только если parent project в server set (чтобы не трогать записи из другой coopname).
 */
export async function detectOrphanIndexEntries(params: {
  readonly root: string
  readonly index: IndexFile
  readonly server: ServerHashSets
  readonly currentCoopname: string
}): Promise<OrphanEntry[]> {
  const { root, index, server, currentCoopname } = params
  const out: OrphanEntry[] = []
  for (const entry of index.entries) {
    if (entry.entity_type !== 'project' && entry.entity_type !== 'issue' && entry.entity_type !== 'story') {
      continue
    }
    const serverSet
      = entry.entity_type === 'project'
        ? server.projectHashes
        : entry.entity_type === 'issue'
          ? server.issueHashes
          : server.storyHashes
    if (serverSet.has(entry.entity_hash)) {
      continue
    }
    const abs = path.join(root, entry.relative_path)
    let raw: string | null = null
    try {
      raw = await fs.readFile(abs, 'utf8')
    }
    catch {
      raw = null
    }
    if (raw === null) {
      out.push({ entry, reason: 'file-missing' })
      continue
    }
    try {
      const parsed = parseBlagoMarkdown(raw)
      if (entry.entity_type === 'project') {
        const coopname = String(parsed.data.coopname ?? '').trim()
        if (coopname && coopname !== currentCoopname) {
          continue
        }
      }
      else {
        const ph = String(parsed.data.project_hash ?? '').trim()
        if (!ph || !server.projectHashes.has(ph)) {
          continue
        }
      }
    }
    catch {
      // файл битый — будем считать orphan по общим правилам
    }
    out.push({ entry, reason: 'deleted-on-server' })
  }
  return out
}

export interface PruneOrphansResult {
  readonly pruned: IndexEntry[]
  readonly keptDirty: IndexEntry[]
  readonly keptStaged: IndexEntry[]
}

/**
 * Удалить orphan-файлы локально и убрать из индекса/staging. Пропускает dirty и staged записи.
 * Возвращает статистику для вывода.
 */
export async function pruneOrphans(
  root: string,
  orphans: readonly OrphanEntry[],
): Promise<PruneOrphansResult> {
  const pruned: IndexEntry[] = []
  const keptDirty: IndexEntry[] = []
  const keptStaged: IndexEntry[] = []
  if (orphans.length === 0) {
    return { pruned, keptDirty, keptStaged }
  }
  const index = await loadIndex(root)
  const staging = await loadStaging(root)
  const stagedSet = new Set(staging.paths.map(p => normalizeRelativePath(p)))

  const toRemoveKeys = new Set<string>()
  const toUnstage = new Set<string>()

  for (const { entry } of orphans) {
    const rel = normalizeRelativePath(entry.relative_path)
    const abs = path.join(root, rel)
    let raw: string | null = null
    try {
      raw = await fs.readFile(abs, 'utf8')
    }
    catch {
      raw = null
    }
    if (raw !== null && sha256Hex(raw) !== entry.content_etag_local) {
      keptDirty.push(entry)
      continue
    }
    if (stagedSet.has(rel)) {
      keptStaged.push(entry)
      continue
    }
    if (raw !== null) {
      try {
        await fs.unlink(abs)
      }
      catch {
        // ignore
      }
    }
    toRemoveKeys.add(`${entry.entity_type}|${entry.entity_hash}`)
    toUnstage.add(rel)
    pruned.push(entry)
  }

  if (toRemoveKeys.size > 0) {
    const nextEntries = index.entries.filter(
      e => !toRemoveKeys.has(`${e.entity_type}|${e.entity_hash}`),
    )
    await saveIndex(root, { entries: nextEntries })
  }
  if (toUnstage.size > 0) {
    const nextPaths = staging.paths.filter(p => !toUnstage.has(normalizeRelativePath(p)))
    if (nextPaths.length !== staging.paths.length) {
      await saveStaging(root, { paths: nextPaths })
    }
  }

  return { pruned, keptDirty, keptStaged }
}
