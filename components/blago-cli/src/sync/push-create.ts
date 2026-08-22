// Первая отправка локально созданных issue / story (ветка Create в push).

import type { AuthenticatedContext } from '../session/index.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { Mutations } from '@coopenomics/sdk'

import { resolveCoopname } from '../config/index.js'
import {
  issueToFrontmatterAndBody,
  issueWorkspaceTitlesFromProjects,
  parseBlagoMarkdown,
  parseFactHoursFromFrontmatter,
  type ParsedBlagoFile,
  serializeBlagoMarkdown,
  storyToFrontmatterAndBody,
} from '../format/index.js'
import { sha256Hex } from '../lib/hash.js'

import { loadContributorUsernameByHash, pushFactHoursDeltas } from './fact-hours.js'
import {
  findByHash,
  normalizeRelativePath,
  replaceStagingPath,
  upsertEntry,
  type IndexFile,
} from './index-store.js'
import { generateSlug, issueFileRelativePath, storyFileRelativePath, workspaceBasePath } from './layout.js'
import { findPendingItem, loadPendingCreate, removePendingItem, type PendingCreateItem } from './pending-create.js'
import { loadProjectMapsFromIndex } from './project-index-map.js'

function toIso(v: unknown): string {
  if (v === undefined || v === null) {
    return ''
  }
  if (v instanceof Date) {
    return v.toISOString()
  }
  if (typeof v === 'string') {
    return new Date(v).toISOString()
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(v).toISOString()
  }
  return ''
}

function requireCoopname(cfg: AuthenticatedContext['config']): string {
  const c = resolveCoopname(cfg)
  if (!c) {
    throw new Error(
      'Укажите coopname в .blago/config.json (активная среда или общий fallback)',
    )
  }
  return c
}

async function ensureDirForFile(absFile: string): Promise<void> {
  await fs.mkdir(path.dirname(absFile), { recursive: true })
}

/** issue_hash из индекса → id и slug для пути требования под задачей. */
export async function issueLinkForStoryPath(
  root: string,
  index: IndexFile,
  issueHash: string,
): Promise<{ id: string, titleSlug: string } | undefined> {
  const entry = findByHash(index, 'issue', issueHash)
  if (!entry) {
    return undefined
  }
  const raw = await fs.readFile(path.join(root, entry.relative_path), 'utf8')
  const parsed = parseBlagoMarkdown(raw)
  if (parsed.type !== 'issue') {
    return undefined
  }
  const idRaw = parsed.data.id
  const id = idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== ''
    ? String(idRaw).trim()
    : String(parsed.data.hash ?? '')
  const titleSlug = generateSlug(String(parsed.data.title ?? '')) || 'issue'
  return { id, titleSlug }
}

export async function pushCreateIssue(
  ctx: AuthenticatedContext,
  index: IndexFile,
  rel: string,
  parsed: ParsedBlagoFile,
  pendingItem: PendingCreateItem,
): Promise<void> {
  const coopname = requireCoopname(ctx.config)
  const { projectByHash, projectRowByHash } = await loadProjectMapsFromIndex(ctx.root, index)
  const projectHash = String(parsed.data.project_hash ?? '')
  const proj = projectByHash.get(projectHash)
  if (!proj) {
    throw new Error(`Задача: проект «${projectHash}» не найден в индексе (нужен «blago pull»).`)
  }

  const creators = Array.isArray(parsed.data.creators)
    ? (parsed.data.creators as unknown[]).map(x => String(x))
    : []
  const labels = Array.isArray(parsed.data.labels)
    ? (parsed.data.labels as unknown[]).map(x => String(x))
    : []

  const issueInput: Mutations.Capital.CreateIssue.IInput['data'] = {
    coopname,
    project_hash: projectHash,
    title: String(parsed.data.title ?? ''),
    description: parsed.body,
    status: parsed.data.status as Mutations.Capital.CreateIssue.IInput['data']['status'],
    priority: parsed.data.priority as Mutations.Capital.CreateIssue.IInput['data']['priority'],
    estimate: Number(parsed.data.estimate ?? 0),
    sort_order: Number(parsed.data.sort_order ?? 0),
    creators,
    labels,
  }
  if (parsed.data.cycle_id) {
    issueInput.cycle_id = String(parsed.data.cycle_id)
  }
  if (parsed.data.submaster) {
    issueInput.submaster = String(parsed.data.submaster)
  }

  const mutationResult = await ctx.client.Mutation(Mutations.Capital.CreateIssue.mutation, {
    variables: { data: issueInput },
  })
  const created = mutationResult[Mutations.Capital.CreateIssue.name]
  if (created == null) {
    throw new Error('Создание задачи: пустой ответ API')
  }
  const createdIssueHash = String(created.issue_hash ?? '').trim()
  const createdProjectHash = String(created.project_hash ?? '').trim()
  if (!createdIssueHash || !createdProjectHash) {
    throw new Error('Создание задачи: в ответе API нет issue_hash или project_hash')
  }

  const usernameByHash = await loadContributorUsernameByHash(ctx, coopname)
  await pushFactHoursDeltas({
    ctx,
    coopname,
    issueHash: createdIssueHash,
    label: `задача ${createdIssueHash}`,
    localData: parsed.data,
    remoteFactByContributor: [],
    usernameByHash,
  })

  let fact_hours: ReturnType<typeof parseFactHoursFromFrontmatter>
  try {
    fact_hours = parseFactHoursFromFrontmatter(parsed.data)
  }
  catch {
    fact_hours = undefined
  }

  const workspace = issueWorkspaceTitlesFromProjects(createdProjectHash, projectRowByHash)
  const { data, body } = issueToFrontmatterAndBody(
    {
      id: created.id,
      title: String(created.title ?? ''),
      description: created.description,
      issue_hash: createdIssueHash,
      project_hash: createdProjectHash,
      cycle_id: created.cycle_id,
      status: created.status,
      priority: created.priority,
      estimate: created.estimate,
      submaster: created.submaster,
      creators: created.creators,
      fact_hours: fact_hours ?? [],
      metadata: created.metadata,
      _created_at: created._created_at as Date | string | null | undefined,
      _updated_at: created._updated_at as Date | string | null | undefined,
    },
    workspace,
  )
  const content = serializeBlagoMarkdown(data, body)
  const basePath = workspaceBasePath(projectByHash.get(createdProjectHash)!, projectByHash)
  const issueCapitalId
    = created.id !== undefined && created.id !== null && String(created.id).trim() !== ''
      ? String(created.id).trim()
      : createdIssueHash
  const newRel = normalizeRelativePath(
    issueFileRelativePath(String(created.title ?? ''), basePath, issueCapitalId),
  )
  const oldRel = normalizeRelativePath(rel)
  const absNew = path.join(ctx.root, newRel)
  const absOld = path.join(ctx.root, oldRel)

  await ensureDirForFile(absNew)
  await fs.writeFile(absNew, content, 'utf8')
  if (oldRel !== newRel && (await fileExists(absOld))) {
    await fs.unlink(absOld)
  }
  if (oldRel !== newRel) {
    await replaceStagingPath(ctx.root, oldRel, newRel)
  }

  const etag = sha256Hex(await fs.readFile(absNew, 'utf8'))
  upsertEntry(index, {
    entity_type: 'issue',
    entity_hash: createdIssueHash,
    relative_path: newRel,
    remote_updated_at: toIso(created._updated_at),
    content_etag_local: etag,
  })

  await removePendingItem(ctx.root, 'issue', pendingItem.entity_hash)
}

async function fileExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs)
    return true
  }
  catch {
    return false
  }
}

export async function pushCreateStory(
  ctx: AuthenticatedContext,
  index: IndexFile,
  rel: string,
  parsed: ParsedBlagoFile,
  pendingItem: PendingCreateItem,
): Promise<void> {
  const coopname = requireCoopname(ctx.config)
  const { projectByHash } = await loadProjectMapsFromIndex(ctx.root, index)
  const storyHash = String(parsed.data.hash ?? '')
  const projectHash = parsed.data.project_hash ? String(parsed.data.project_hash) : ''
  const issueHash = parsed.data.issue_hash ? String(parsed.data.issue_hash) : ''
  if (!projectHash && !issueHash) {
    throw new Error('Требование: укажите project_hash и/или issue_hash во frontmatter')
  }
  const proj = projectHash ? projectByHash.get(projectHash) : undefined
  if (projectHash && !proj) {
    throw new Error(`Требование: проект «${projectHash}» не найден в индексе`)
  }

  const storyInput: Mutations.Capital.CreateStory.IInput['data'] = {
    coopname,
    story_hash: storyHash,
    title: String(parsed.data.title ?? ''),
    description: parsed.body,
    content_format: parsed.data.content_format as Mutations.Capital.CreateStory.IInput['data']['content_format'],
    status: parsed.data.status as Mutations.Capital.CreateStory.IInput['data']['status'],
    sort_order: Number(parsed.data.sort_order ?? 0),
  }
  if (projectHash) {
    storyInput.project_hash = projectHash
  }
  if (issueHash) {
    storyInput.issue_hash = issueHash
  }

  const mutationResult = await ctx.client.Mutation(Mutations.Capital.CreateStory.mutation, {
    variables: { data: storyInput },
  })
  const created = mutationResult[Mutations.Capital.CreateStory.name]
  if (created == null) {
    throw new Error('Создание требования: пустой ответ API')
  }

  const { data, body } = storyToFrontmatterAndBody({
    _id: created._id,
    title: created.title,
    description: created.description,
    story_hash: created.story_hash,
    content_format: created.content_format,
    status: created.status,
    created_by: created.created_by,
    sort_order: created.sort_order,
    project_hash: created.project_hash,
    issue_hash: created.issue_hash,
    _created_at: created._created_at,
    _updated_at: created._updated_at,
  })
  const content = serializeBlagoMarkdown(data, body)

  const projRow = created.project_hash ? projectByHash.get(String(created.project_hash)) : undefined
  if (!projRow) {
    throw new Error('Требование после create: не удалось разрешить project_hash для пути файла')
  }
  const basePath = workspaceBasePath(projRow, projectByHash)
  let issueArg: { id: string, titleSlug: string } | undefined
  if (created.issue_hash) {
    issueArg = await issueLinkForStoryPath(ctx.root, index, String(created.issue_hash))
  }
  const storyRecordId
    = created._id !== undefined && created._id !== null && String(created._id).trim() !== ''
      ? String(created._id).trim()
      : created.story_hash
  const newRel = normalizeRelativePath(
    storyFileRelativePath(created.title, basePath, storyRecordId, created.story_hash, issueArg),
  )
  const oldRel = normalizeRelativePath(rel)
  const absNew = path.join(ctx.root, newRel)
  const absOld = path.join(ctx.root, oldRel)

  await ensureDirForFile(absNew)
  await fs.writeFile(absNew, content, 'utf8')
  if (oldRel !== newRel && (await fileExists(absOld))) {
    await fs.unlink(absOld)
  }
  if (oldRel !== newRel) {
    await replaceStagingPath(ctx.root, oldRel, newRel)
  }

  const etag = sha256Hex(await fs.readFile(absNew, 'utf8'))
  upsertEntry(index, {
    entity_type: 'story',
    entity_hash: created.story_hash,
    relative_path: newRel,
    remote_updated_at: toIso(created._updated_at),
    content_etag_local: etag,
  })

  await removePendingItem(ctx.root, 'story', pendingItem.entity_hash)
}

export async function findPendingForParsed(
  root: string,
  kind: 'issue' | 'story',
  entityHash: string,
): Promise<PendingCreateItem | undefined> {
  const data = await loadPendingCreate(root)
  return findPendingItem(data, kind, entityHash)
}
