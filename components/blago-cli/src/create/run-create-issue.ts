// Создание задачи на сервере сразу (CreateIssue); локальный .md с id/hash и пустым телом (FR-016).

import type { AuthenticatedContext } from '../session/index.js'
import * as fs from 'node:fs/promises'

import * as path from 'node:path'

import { Mutations } from '@coopenomics/sdk'
import { resolveCoopname } from '../config/index.js'
import {
  issueToFrontmatterAndBody,
  issueWorkspaceTitlesFromProjects,
  serializeBlagoMarkdown,
} from '../format/index.js'
import { capitalIdPathPrefix } from '../lib/capital-id-path.js'
import { sha256Hex } from '../lib/hash.js'
import { loadSession } from '../session/index.js'
import {
  appendPathsToStaging,
  loadIndex,
  normalizeRelativePath,
  saveIndex,
  upsertEntry,
} from '../sync/index-store.js'
import { generateSlug, issueFileRelativePath, workspaceBasePath } from '../sync/layout.js'
import { loadProjectMapsFromIndex } from '../sync/project-index-map.js'
import { refreshParentProjectVersion } from '../sync/refresh-parent.js'
import { writeWorkspaceIndexMarkdown } from '../sync/workspace-index.js'

import { resolveProjectMarker } from './resolve-base.js'

async function fileExistsAbs(abs: string): Promise<boolean> {
  try {
    await fs.access(abs)
    return true
  }
  catch {
    return false
  }
}

function parseCreatorsCsv(v: string | undefined): string[] {
  if (v === undefined || v.trim() === '') {
    return []
  }
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

function toRemoteIso(v: unknown): string {
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

/** Канонический путь по id задачи; при коллизии имя файла — с суффиксом от issue_hash. */
async function pickIssueFileRelativePath(
  root: string,
  title: string,
  basePath: string,
  issueCapitalId: string,
  issueHash: string,
): Promise<string> {
  const primary = issueFileRelativePath(title, basePath, issueCapitalId)
  const absPrimary = path.join(root, primary)
  if (!(await fileExistsAbs(absPrimary))) {
    return normalizeRelativePath(primary)
  }
  const slug = generateSlug(title) || 'issue'
  const idp = capitalIdPathPrefix(issueCapitalId)
  const dir = `${basePath.replace(/\\/g, '/')}/issues`
  const alt = `${dir}/${idp}-${slug}-${issueHash.slice(0, 8)}.md`
  const absAlt = path.join(root, alt)
  if (!(await fileExistsAbs(absAlt))) {
    return normalizeRelativePath(alt)
  }
  throw new Error(`Не удалось подобрать свободное имя файла в «${dir}»`)
}

export interface RunCreateIssueOptions {
  /** Тело описания (markdown), попадает в description на сервере и в тело .md */
  readonly description?: string
  readonly setSelf?: boolean
  readonly creatorsCsv?: string
  readonly submaster?: string
}

export async function runCreateIssue(
  ctx: AuthenticatedContext,
  basePathArg: string,
  title: string,
  options: RunCreateIssueOptions,
): Promise<{ relativePath: string }> {
  const coopCfg = resolveCoopname(ctx.config)
  if (!coopCfg) {
    throw new Error('Задайте coopname в config активной среды (или «blago init --coopname»)')
  }

  const index = await loadIndex(ctx.root)
  const { projectByHash, projectRowByHash } = await loadProjectMapsFromIndex(ctx.root, index)
  const marker = await resolveProjectMarker(ctx.root, basePathArg)
  const proj = projectByHash.get(marker.project_hash)
  if (!proj) {
    throw new Error(
      `Проект «${marker.project_hash}» не найден в индексе. Выполните «blago pull» и повторите create.`,
    )
  }

  const fromCsv = parseCreatorsCsv(options.creatorsCsv)
  let creators: string[]
  if (options.setSelf) {
    const session = await loadSession(ctx.root, ctx.config.activeEnv)
    if (!session) {
      throw new Error(
        'Для --set-self нужна сохранённая сессия активной среды. Выполните «blago login».',
      )
    }
    const u = session.username.trim()
    creators = [u, ...fromCsv.filter(c => c !== u)]
  }
  else {
    creators = fromCsv
  }

  const projectHash = marker.project_hash
  type CreateIssueData = Mutations.Capital.CreateIssue.IInput['data']
  const issueInput: CreateIssueData = {
    coopname: coopCfg,
    project_hash: projectHash,
    title,
    description: options.description?.trim() ?? '',
    status: 'BACKLOG' as CreateIssueData['status'],
    priority: 'MEDIUM' as CreateIssueData['priority'],
    estimate: 0,
    sort_order: 0,
    creators,
    labels: [],
  }
  if (options.submaster !== undefined && options.submaster.trim() !== '') {
    issueInput.submaster = options.submaster.trim()
  }

  const mutationResult = await ctx.client.Mutation(Mutations.Capital.CreateIssue.mutation, {
    variables: { data: issueInput },
  })
  const created = mutationResult[Mutations.Capital.CreateIssue.name]
  if (created == null) {
    throw new Error('Создание задачи: пустой ответ API')
  }

  const createdRow = created as {
    id?: string | null
    title: string
    description?: string | null
    issue_hash: string
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
  const workspace = issueWorkspaceTitlesFromProjects(createdRow.project_hash, projectRowByHash)
  const { data, body } = issueToFrontmatterAndBody(
    {
      id: createdRow.id,
      title: createdRow.title,
      description: createdRow.description,
      issue_hash: createdRow.issue_hash,
      project_hash: createdRow.project_hash,
      cycle_id: createdRow.cycle_id,
      status: createdRow.status,
      priority: createdRow.priority,
      estimate: createdRow.estimate,
      submaster: createdRow.submaster,
      creators: createdRow.creators,
      metadata: createdRow.metadata,
      _created_at: createdRow._created_at,
      _updated_at: createdRow._updated_at,
    },
    workspace,
  )

  const projRow = projectByHash.get(createdRow.project_hash)
  if (!projRow) {
    throw new Error(`Проект «${createdRow.project_hash}» не найден в индексе после создания задачи.`)
  }
  const wsBase = workspaceBasePath(projRow, projectByHash)
  const issueCapitalId
    = createdRow.id !== undefined && createdRow.id !== null && String(createdRow.id).trim() !== ''
      ? String(createdRow.id).trim()
      : createdRow.issue_hash
  const rel = await pickIssueFileRelativePath(
    ctx.root,
    String(createdRow.title ?? title),
    wsBase,
    issueCapitalId,
    createdRow.issue_hash,
  )
  const abs = path.join(ctx.root, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, serializeBlagoMarkdown(data, body), 'utf8')

  const etag = sha256Hex(await fs.readFile(abs, 'utf8'))
  upsertEntry(index, {
    entity_type: 'issue',
    entity_hash: createdRow.issue_hash,
    relative_path: rel,
    remote_updated_at: toRemoteIso(createdRow._updated_at),
    content_etag_local: etag,
  })
  await refreshParentProjectVersion(ctx, index, createdRow.project_hash, projRow.parent_hash)
  await saveIndex(ctx.root, index)
  await appendPathsToStaging(ctx.root, [rel])
  await writeWorkspaceIndexMarkdown(ctx.root)
  return { relativePath: rel }
}
