// Создание требования (story) на сервере сразу (CreateStory); локальный .md с id/hash с сервера.

import type { AuthenticatedContext } from '../session/index.js'
import * as fs from 'node:fs/promises'

import * as path from 'node:path'

import { Mutations, Zeus } from '@coopenomics/sdk'
import { resolveCoopname } from '../config/index.js'
import { serializeBlagoMarkdown, storyToFrontmatterAndBody } from '../format/index.js'
import { capitalIdPathPrefix, storyRequirementIdPrefix2 } from '../lib/capital-id-path.js'
import { generateEntityHashHex64 } from '../lib/generate-entity-hash.js'
import { sha256Hex } from '../lib/hash.js'
import {
  appendPathsToStaging,
  loadIndex,
  normalizeRelativePath,
  saveIndex,
  upsertEntry,
} from '../sync/index-store.js'
import { generateSlug, storyFileRelativePath, workspaceBasePath } from '../sync/layout.js'
import { loadProjectMapsFromIndex } from '../sync/project-index-map.js'
import { issueLinkForStoryPath } from '../sync/push-create.js'
import { refreshParentProjectVersion } from '../sync/refresh-parent.js'
import { writeWorkspaceIndexMarkdown } from '../sync/workspace-index.js'

import { resolveProjectMarker } from './resolve-base.js'
import { storyContentFormatFromCliOption } from './story-format.js'

async function fileExistsAbs(abs: string): Promise<boolean> {
  try {
    await fs.access(abs)
    return true
  }
  catch {
    return false
  }
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

async function pickStoryFileRelativePath(
  root: string,
  title: string,
  basePath: string,
  storyRecordId: string,
  storyHash: string,
  issueArg?: { readonly id: string, readonly titleSlug: string },
): Promise<string> {
  const primary = storyFileRelativePath(title, basePath, storyRecordId, storyHash, issueArg)
  const absPrimary = path.join(root, primary)
  if (!(await fileExistsAbs(absPrimary))) {
    return normalizeRelativePath(primary)
  }
  const slug = generateSlug(title) || 'requirement'
  const id2 = storyRequirementIdPrefix2(storyRecordId, storyHash)
  const dir = issueArg?.titleSlug
    ? `${basePath.replace(/\\/g, '/')}/issue-requirements/${capitalIdPathPrefix(issueArg.id)}-${issueArg.titleSlug}`
    : `${basePath.replace(/\\/g, '/')}/requirements`
  const alt = `${dir}/${id2}-${slug}-${storyHash.slice(0, 6)}.md`
  const absAlt = path.join(root, alt)
  if (!(await fileExistsAbs(absAlt))) {
    return normalizeRelativePath(alt)
  }
  throw new Error(`Не удалось подобрать свободное имя файла в «${dir}»`)
}

export interface RunCreateStoryOptions {
  /** markdown | mermaid | drawio | bpmn */
  readonly format?: string
  /** issue_hash задачи — требование создаётся привязанным к задаче (путь под issues/…-requirements/) */
  readonly issueHash?: string
}

export async function runCreateStory(
  ctx: AuthenticatedContext,
  basePathArg: string,
  title: string,
  description: string,
  options: RunCreateStoryOptions,
): Promise<{ relativePath: string }> {
  const coopCfg = resolveCoopname(ctx.config)
  if (!coopCfg) {
    throw new Error('Задайте coopname в config активной среды (или «blago init --coopname»)')
  }

  const index = await loadIndex(ctx.root)
  const { projectByHash } = await loadProjectMapsFromIndex(ctx.root, index)
  const marker = await resolveProjectMarker(ctx.root, basePathArg)
  const proj = projectByHash.get(marker.project_hash)
  if (!proj) {
    throw new Error(
      `Проект «${marker.project_hash}» не найден в индексе. Выполните «blago pull» и повторите create.`,
    )
  }

  const content_format = storyContentFormatFromCliOption(options.format ?? 'markdown')
  const storyHash = generateEntityHashHex64()
  const projectHash = marker.project_hash

  let issueHashOpt = options.issueHash?.trim() ?? ''
  if (issueHashOpt !== '') {
    const entry = index.entries.find(e => e.entity_type === 'issue' && e.entity_hash === issueHashOpt)
    if (!entry) {
      throw new Error(
        `Задача с issue_hash «${issueHashOpt}» не найдена в индексе. Выполните «blago pull» или проверьте hash.`,
      )
    }
  }
  else {
    issueHashOpt = ''
  }

  type CreateStoryData = Mutations.Capital.CreateStory.IInput['data']
  const storyInput: CreateStoryData = {
    coopname: coopCfg,
    story_hash: storyHash,
    title,
    description: description.trim(),
    content_format: content_format as CreateStoryData['content_format'],
    status: Zeus.StoryStatus.PENDING,
    sort_order: 0,
    project_hash: projectHash,
  }
  if (issueHashOpt !== '') {
    storyInput.issue_hash = issueHashOpt
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

  const rel = await pickStoryFileRelativePath(
    ctx.root,
    String(created.title ?? title),
    basePath,
    storyRecordId,
    created.story_hash,
    issueArg,
  )
  const abs = path.join(ctx.root, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, serializeBlagoMarkdown(data, body), 'utf8')

  const etag = sha256Hex(await fs.readFile(abs, 'utf8'))
  upsertEntry(index, {
    entity_type: 'story',
    entity_hash: created.story_hash,
    relative_path: rel,
    remote_updated_at: toRemoteIso(created._updated_at),
    content_etag_local: etag,
  })
  if (created.project_hash) {
    await refreshParentProjectVersion(ctx, index, String(created.project_hash), projRow.parent_hash)
  }
  await saveIndex(ctx.root, index)
  await appendPathsToStaging(ctx.root, [rel])
  await writeWorkspaceIndexMarkdown(ctx.root)
  return { relativePath: rel }
}
