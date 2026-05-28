// Frontmatter ↔ тело; сериализация как у Capital FileFormatService.

import matter from 'gray-matter'

import { effectiveParentHash } from '../lib/parent-hash.js'

export type EntityFrontmatterType = 'project' | 'issue' | 'story'

export interface ParsedBlagoFile {
  readonly type: EntityFrontmatterType
  readonly data: Record<string, unknown>
  readonly body: string
}

function toIso(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return undefined
}

export function parseBlagoMarkdown(raw: string): ParsedBlagoFile {
  const file = matter(raw)
  const typeRaw = file.data.type
  if (typeRaw !== 'project' && typeRaw !== 'issue' && typeRaw !== 'story') {
    throw new Error(`Неизвестный или отсутствующий type во frontmatter: ${String(typeRaw)}`)
  }
  return {
    type: typeRaw,
    data: file.data as Record<string, unknown>,
    body: file.content.trimEnd(),
  }
}

/** Не бросает: возвращает тип сущности blago, если файл — корректный project/issue/story; иначе undefined. */
export function peekBlagoEntityType(raw: string): EntityFrontmatterType | undefined {
  let file: ReturnType<typeof matter>
  try {
    file = matter(raw)
  }
  catch {
    return undefined
  }
  const t = file.data?.type
  if (t === 'project' || t === 'issue' || t === 'story') {
    return t
  }
  return undefined
}

export function serializeBlagoMarkdown(data: Record<string, unknown>, body: string): string {
  const trimmed = body.endsWith('\n') ? body : `${body}\n`
  // matter.stringify(string, data) сначала парсит string как frontmatter — body, начинающийся
  // с «---», ловится как фронтматтер и роняет js-yaml на коде вида `Authorization: Bearer …`.
  // Передаём пустой контент в matter.stringify, чтобы получить только заголовок, и сами клеим body.
  // Нормализуем хвост: gray-matter дописывает лишний `\n` к пустому контенту — это даёт
  // ложную «грязь» на следующем pull (etag сходит с тем, что было сохранено как простой stringify).
  const head = matter.stringify('', data).replace(/\n+$/, '\n')
  return `${head}${trimmed}`
}

export function issueLabelsFromMetadata(metadata: unknown): string[] {
  if (metadata && typeof metadata === 'object' && metadata !== null && 'labels' in metadata) {
    const labels = (metadata as { labels?: unknown }).labels
    if (Array.isArray(labels)) {
      return labels.map(x => String(x)).filter(s => s.trim() !== '')
    }
  }
  if (typeof metadata === 'string' && metadata.trim()) {
    try {
      const parsed = JSON.parse(metadata) as { labels?: unknown }
      if (Array.isArray(parsed.labels)) {
        return parsed.labels.map(x => String(x)).filter(s => s.trim() !== '')
      }
    }
    catch {
      return []
    }
  }
  return []
}

/** Цепочка родителей: [проект задачи, …, корневой проект] — для подписей в issue. */
export function issueWorkspaceTitlesFromProjects(
  issueProjectHash: string,
  rowByHash: ReadonlyMap<string, { title?: string | null, parent_hash?: string | null }>,
): { project_title: string, component_title?: string } {
  const titles: string[] = []
  let cur: string | undefined = issueProjectHash
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const row = rowByHash.get(cur)
    if (!row) {
      break
    }
    titles.push(String(row.title ?? '').trim())
    const parentRef = effectiveParentHash(row.parent_hash)
    cur = parentRef || undefined
  }
  const project_title = titles.length > 0 ? titles[titles.length - 1] : ''
  const component_title = titles.length > 1 ? titles[0] : undefined
  return {
    project_title,
    ...(component_title !== undefined && component_title !== '' ? { component_title } : {}),
  }
}

/** Проект из ответа capitalProjects / capitalProject */
export function projectToFrontmatterAndBody(project: {
  id?: number | null
  title?: string | null
  description?: string | null
  project_hash: string
  coopname: string
  parent_hash?: string | null
  parent_title?: string | null
  status?: string | null
  created_at?: Date | string | null
  _updated_at?: Date | string | null
}): { data: Record<string, unknown>, body: string } {
  const data: Record<string, unknown> = {}
  data.type = 'project'
  if (project.id !== undefined && project.id !== null && Number.isFinite(Number(project.id))) {
    data.id = Number(project.id)
  }
  data.title = project.title ?? ''
  const parentRef = effectiveParentHash(project.parent_hash)
  if (parentRef) {
    const pt = project.parent_title
    if (pt !== undefined && pt !== null && String(pt).trim() !== '') {
      data.parent_title = String(pt).trim()
    }
    data.parent_hash = parentRef
  }
  data.coopname = project.coopname
  data.status = project.status ?? undefined
  data.hash = project.project_hash
  const c = toIso(project.created_at)
  if (c) {
    data.created_at = c
  }
  const u = toIso(project._updated_at)
  if (u) {
    data.updated_at = u
  }
  return { data, body: project.description ?? '' }
}

export function issueToFrontmatterAndBody(
  issue: {
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
  },
  workspace: { project_title: string, component_title?: string },
): { data: Record<string, unknown>, body: string } {
  const data: Record<string, unknown> = {}
  data.type = 'issue'
  const capitalIssueId
    = issue.id !== undefined && issue.id !== null && String(issue.id).trim() !== ''
      ? String(issue.id).trim()
      : issue.issue_hash
  data.id = capitalIssueId
  data.title = issue.title
  if (workspace.project_title.trim() !== '') {
    data.project_title = workspace.project_title.trim()
  }
  if (workspace.component_title !== undefined && workspace.component_title.trim() !== '') {
    data.component_title = workspace.component_title.trim()
  }
  data.status = issue.status ?? 'backlog'
  data.priority = issue.priority ?? 'medium'
  data.estimate = issue.estimate ?? 0
  data.creators = issue.creators ?? []
  data.labels = issueLabelsFromMetadata(issue.metadata)
  if (issue.cycle_id) {
    data.cycle_id = issue.cycle_id
  }
  if (issue.submaster) {
    data.submaster = issue.submaster
  }
  data.hash = issue.issue_hash
  data.project_hash = issue.project_hash
  const c = toIso(issue._created_at)
  if (c) {
    data.created_at = c
  }
  const u = toIso(issue._updated_at)
  if (u) {
    data.updated_at = u
  }
  return { data, body: issue.description ?? '' }
}

export function storyToFrontmatterAndBody(story: {
  _id?: string | null
  title: string
  description?: string | null
  story_hash: string
  content_format?: string | null
  status?: string | null
  created_by?: string | null
  sort_order?: number | null
  project_hash?: string | null
  issue_hash?: string | null
  _created_at?: Date | string | null
  _updated_at?: Date | string | null
}): { data: Record<string, unknown>, body: string } {
  const data: Record<string, unknown> = {}
  data.type = 'story'
  if (story._id !== undefined && story._id !== null && String(story._id).trim() !== '') {
    data.id = String(story._id)
  }
  data.title = story.title
  data.hash = story.story_hash
  data.content_format = story.content_format ?? 'MARKDOWN'
  data.status = story.status ?? 'pending'
  data.created_by = story.created_by ?? ''
  data.sort_order = story.sort_order ?? 0
  if (story.project_hash) {
    data.project_hash = story.project_hash
  }
  if (story.issue_hash) {
    data.issue_hash = story.issue_hash
  }
  const c = toIso(story._created_at)
  if (c) {
    data.created_at = c
  }
  const u = toIso(story._updated_at)
  if (u) {
    data.updated_at = u
  }
  return { data, body: story.description ?? '' }
}
