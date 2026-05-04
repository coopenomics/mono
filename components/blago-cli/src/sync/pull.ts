// pull: SDK → файлы; индекс по hash; смена slug → перенос (FR-014).

import type { AuthenticatedContext } from '../session/index.js'

import { Queries } from '@coopenomics/sdk'

import { type BlagoConfigFile, resolveCoopname } from '../config/index.js'
import {
  issueToFrontmatterAndBody,
  issueWorkspaceTitlesFromProjects,
  projectToFrontmatterAndBody,
  serializeBlagoMarkdown,
  storyToFrontmatterAndBody,
} from '../format/index.js'
import { info, warn } from '../ui/output.js'
import {
  detectOrphanIndexEntries,
  type OrphanEntry,
  pruneOrphans,
  type ServerHashSets,
} from './delete.js'
import { loadIndex, saveIndex } from './index-store.js'
import {
  generateSlug,
  issueFileRelativePath,
  projectFileRelativePath,
  type ProjectPathModel,
  storyFileRelativePath,
  workspaceBasePath,
} from './layout.js'
import { pullProjectCommunicationArtifacts } from './pull-communication.js'
import { scaffoldBmadWorkspacesAfterPull } from './scaffold-bmad-workspace.js'
import { syncEntityFile } from './sync-entity-file.js'
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
  components?: CapitalProjectRow[] | null
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
  created_by?: string | null
  submaster?: string | null
  creators?: string[] | null
  metadata?: unknown
  sort_order?: number | null
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
  created_by?: string | null
  sort_order?: number | null
  project_hash?: string | null
  issue_hash?: string | null
  _created_at?: Date | string | null
  _updated_at?: Date | string | null
}

function flattenProjects(roots: CapitalProjectRow[]): CapitalProjectRow[] {
  const out: CapitalProjectRow[] = []
  const walk = (p: CapitalProjectRow): void => {
    out.push(p)
    for (const c of p.components ?? []) {
      walk(c)
    }
  }
  for (const r of roots) {
    walk(r)
  }
  return out
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

function requireCoopname(cfg: BlagoConfigFile): string {
  const c = resolveCoopname(cfg)
  if (!c) {
    throw new Error(
      'Укажите coopname в .blago/config.json в environments.<активнаяСреда> (или запасной «coopname» сверху), либо: blago init --coopname <имя>',
    )
  }
  return c
}

export interface RunPullOptions {
  /** Удалить локальные файлы и записи индекса для сущностей, которых нет в выборке pull (orphan). По умолчанию — только предупреждение. */
  readonly prune?: boolean
}

export async function runPull(ctx: AuthenticatedContext, options: RunPullOptions = {}): Promise<void> {
  const coopname = requireCoopname(ctx.config)
  const index = await loadIndex(ctx.root)
  const projectByHash = new Map<string, ProjectPathModel>()

  const allProjects: CapitalProjectRow[] = []
  const seen = new Set<string>()
  let page = 1
  for (;;) {
    const { [Queries.Capital.GetProjects.name]: pageResult } = await ctx.client.Query(
      Queries.Capital.GetProjects.query,
      {
        variables: {
          filter: { coopname },
          options: { limit: 100, page, sortOrder: 'DESC' },
        },
      },
    )
    const chunk = pageResult.items as CapitalProjectRow[]
    for (const item of chunk) {
      for (const p of flattenProjects([item])) {
        if (!seen.has(p.project_hash)) {
          seen.add(p.project_hash)
          allProjects.push(p)
        }
      }
    }
    if (page >= pageResult.totalPages) {
      break
    }
    page += 1
  }

  page = 1
  for (;;) {
    const { [Queries.Capital.GetProjects.name]: pageResult } = await ctx.client.Query(
      Queries.Capital.GetProjects.query,
      {
        variables: {
          filter: { coopname, is_component: true },
          options: { limit: 100, page, sortOrder: 'DESC' },
        },
      },
    )
    const chunk = pageResult.items as CapitalProjectRow[]
    for (const item of chunk) {
      for (const p of flattenProjects([item])) {
        if (!seen.has(p.project_hash)) {
          seen.add(p.project_hash)
          allProjects.push(p)
        }
      }
    }
    if (page >= pageResult.totalPages) {
      break
    }
    page += 1
  }

  for (const p of allProjects) {
    projectByHash.set(p.project_hash, asProjectPathModel(p))
  }

  const projectRowByHash = new Map<string, CapitalProjectRow>()
  for (const p of allProjects) {
    projectRowByHash.set(p.project_hash, p)
  }

  for (const p of allProjects) {
    const { data, body } = projectToFrontmatterAndBody(p)
    const content = serializeBlagoMarkdown(data, body)
    const rel = projectFileRelativePath(asProjectPathModel(p), projectByHash)
    await syncEntityFile({
      root: ctx.root,
      index,
      entityType: 'project',
      entityHash: p.project_hash,
      relativePath: rel,
      content,
      remoteUpdatedAt: toUpdatedIso(p._updated_at),
      label: `проект ${p.project_hash}`,
    })
  }

  const issues: CapitalIssueRow[] = []
  page = 1
  for (;;) {
    const { [Queries.Capital.GetIssues.name]: pageResult } = await ctx.client.Query(
      Queries.Capital.GetIssues.query,
      {
        variables: {
          filter: { coopname },
          options: { limit: 200, page, sortOrder: 'DESC' },
        },
      },
    )
    const chunk = pageResult.items as CapitalIssueRow[]
    issues.push(...chunk)
    if (page >= pageResult.totalPages) {
      break
    }
    page += 1
  }

  const issueByHash = new Map<string, CapitalIssueRow>()
  for (const i of issues) {
    issueByHash.set(i.issue_hash, i)
  }

  for (const i of issues) {
    const proj = projectByHash.get(i.project_hash)
    if (!proj) {
      warn(`Задача ${i.issue_hash}: проект ${i.project_hash} не найден в выборке, пропуск`)
      continue
    }
    const basePath = workspaceBasePath(proj, projectByHash)
    const issueCapitalId = i.id !== undefined && i.id !== null && String(i.id).trim() !== '' ? String(i.id) : i.issue_hash
    const rel = issueFileRelativePath(i.title, basePath, issueCapitalId)
    const workspace = issueWorkspaceTitlesFromProjects(i.project_hash, projectRowByHash)
    const { data, body } = issueToFrontmatterAndBody(i, workspace)
    const content = serializeBlagoMarkdown(data, body)
    await syncEntityFile({
      root: ctx.root,
      index,
      entityType: 'issue',
      entityHash: i.issue_hash,
      relativePath: rel,
      content,
      remoteUpdatedAt: toUpdatedIso(i._updated_at),
      label: `задача ${i.issue_hash}`,
    })
  }

  const stories: CapitalStoryRow[] = []
  page = 1
  for (;;) {
    const { [Queries.Capital.GetStories.name]: pageResult } = await ctx.client.Query(
      Queries.Capital.GetStories.query,
      {
        variables: {
          filter: {
            coopname,
            show_issues_requirements: true,
            show_components_requirements: true,
          },
          options: { limit: 200, page, sortOrder: 'DESC' },
        },
      },
    )
    const chunk = pageResult.items as CapitalStoryRow[]
    stories.push(...chunk)
    if (page >= pageResult.totalPages) {
      break
    }
    page += 1
  }

  for (const s of stories) {
    if (!s.project_hash) {
      warn(`Требование ${s.story_hash}: нет project_hash, пропуск`)
      continue
    }
    const proj = projectByHash.get(s.project_hash)
    if (!proj) {
      warn(`Требование ${s.story_hash}: проект ${s.project_hash} не найден, пропуск`)
      continue
    }
    const basePath = workspaceBasePath(proj, projectByHash)
    let issueArg: { id: string, titleSlug: string } | undefined
    if (s.issue_hash) {
      const iss = issueByHash.get(s.issue_hash)
      if (iss) {
        const issueId = iss.id !== undefined && iss.id !== null && String(iss.id).trim() !== '' ? String(iss.id) : iss.issue_hash
        issueArg = {
          id: issueId,
          titleSlug: generateSlug(iss.title) || 'issue',
        }
      }
    }
    const storyRecordId
      = s._id !== undefined && s._id !== null && String(s._id).trim() !== '' ? String(s._id) : s.story_hash
    const rel = storyFileRelativePath(s.title, basePath, storyRecordId, s.story_hash, issueArg)
    const { data, body } = storyToFrontmatterAndBody(s)
    const content = serializeBlagoMarkdown(data, body)
    await syncEntityFile({
      root: ctx.root,
      index,
      entityType: 'story',
      entityHash: s.story_hash,
      relativePath: rel,
      content,
      remoteUpdatedAt: toUpdatedIso(s._updated_at),
      label: `требование ${s.story_hash}`,
    })
  }

  await pullProjectCommunicationArtifacts(ctx, index, allProjects, projectByHash)

  await scaffoldBmadWorkspacesAfterPull(ctx, allProjects, projectByHash)

  await saveIndex(ctx.root, index)

  const server: ServerHashSets = {
    projectHashes: new Set(allProjects.map(p => p.project_hash)),
    issueHashes: new Set(issues.map(i => i.issue_hash)),
    storyHashes: new Set(stories.map(s => s.story_hash)),
  }
  const orphans = await detectOrphanIndexEntries({
    root: ctx.root,
    index: await loadIndex(ctx.root),
    server,
    currentCoopname: coopname,
  })
  await reportAndMaybePruneOrphans(ctx.root, orphans, options.prune === true)
  await writeWorkspaceIndexMarkdown(ctx.root)
}

async function reportAndMaybePruneOrphans(
  root: string,
  orphans: readonly OrphanEntry[],
  prune: boolean,
): Promise<void> {
  if (orphans.length === 0) {
    return
  }
  if (!prune) {
    warn(`Удалены на сервере (или файл пропал) — ${orphans.length} шт. Запустите «blago pull --prune», чтобы очистить локально:`)
    for (const o of orphans) {
      const tag = o.reason === 'file-missing' ? 'файл отсутствует' : 'удалено на сервере'
      warn(`  - [${o.entry.entity_type}] ${o.entry.relative_path}  (${tag})`)
    }
    return
  }
  const { pruned, keptDirty, keptStaged } = await pruneOrphans(root, orphans)
  if (pruned.length > 0) {
    info(`Удалено локально (orphan prune) — ${pruned.length}:`)
    for (const e of pruned) {
      info(`  - [${e.entity_type}] ${e.relative_path}`)
    }
  }
  for (const e of keptDirty) {
    warn(`Оставлено (локальные изменения, используйте blago del --force): ${e.relative_path}`)
  }
  for (const e of keptStaged) {
    warn(`Оставлено (в staging, сначала blago remove или blago del --force): ${e.relative_path}`)
  }
}
