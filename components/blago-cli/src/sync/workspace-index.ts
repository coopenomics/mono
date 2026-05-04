// INDEX.md в корне рабочей копии: для быстрого поиска проекта/компонента/требования
// по id или фрагменту названия (LLM-агентам не нужно ходить по дереву ls'ом).
// Задачи (issues) сюда намеренно не попадают: их слишком много, ищут их с привязкой
// к проекту/компоненту, а сам проект/компонент находится по этому индексу.
// Обновляется автоматически на pull/push/create/del/restore/clean.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { parseBlagoMarkdown } from '../format/index.js'
import { effectiveParentHash } from '../lib/parent-hash.js'
import { loadIndex, normalizeRelativePath } from './index-store.js'

interface ProjectRow {
  readonly id?: string
  readonly hash: string
  readonly title: string
  readonly rel: string
  readonly parentHash?: string
}

interface StoryRow {
  readonly id?: string
  readonly hash: string
  readonly title: string
  readonly rel: string
  readonly projectHash?: string
  readonly issueHash?: string
}

const INDEX_MARKDOWN_FILENAME = 'INDEX.md'

function pickIdString(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) {
    return undefined
  }
  const s = String(raw).trim()
  return s === '' ? undefined : s
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Идентификаторы требований приходят как UUID — для индекса оставляем первые 8 символов
 *  (uniqueness в рамках копии практически 100%, поиск по полному id всё равно работает через frontmatter). */
function shortDisplayId(id: string | undefined): string {
  if (id === undefined) {
    return '?'
  }
  if (UUID_RE.test(id)) {
    return id.slice(0, 8)
  }
  return id
}

function sortByIdNumeric<T extends { id?: string, title: string }>(a: T, b: T): number {
  const ai = a.id ?? ''
  const bi = b.id ?? ''
  const cmp = ai.localeCompare(bi, 'en', { numeric: true, sensitivity: 'base' })
  if (cmp !== 0) {
    return cmp
  }
  return a.title.localeCompare(b.title, 'ru')
}

export async function writeWorkspaceIndexMarkdown(root: string): Promise<void> {
  const index = await loadIndex(root)
  const projects: ProjectRow[] = []
  const stories: StoryRow[] = []
  const issueIdByHash = new Map<string, string>()

  for (const e of index.entries) {
    if (e.entity_type !== 'project' && e.entity_type !== 'story' && e.entity_type !== 'issue') {
      continue
    }
    const rel = normalizeRelativePath(e.relative_path)
    const abs = path.join(root, rel)
    let raw: string
    try {
      raw = await fs.readFile(abs, 'utf8')
    }
    catch {
      continue
    }
    let parsed
    try {
      parsed = parseBlagoMarkdown(raw)
    }
    catch {
      continue
    }
    const id = pickIdString(parsed.data.id)
    const title = String(parsed.data.title ?? '').trim()
    if (e.entity_type === 'project') {
      const parent = effectiveParentHash(
        parsed.data.parent_hash === undefined || parsed.data.parent_hash === null
          ? undefined
          : String(parsed.data.parent_hash),
      )
      projects.push({ id, hash: e.entity_hash, title, rel, parentHash: parent })
    }
    else if (e.entity_type === 'issue') {
      // Задачи в INDEX.md не выводятся (слишком много шума), но id нужен
      // для подписи под требованиями, привязанными к задаче (issue_hash).
      if (id !== undefined) {
        issueIdByHash.set(e.entity_hash, id)
      }
    }
    else {
      const projectHash = parsed.data.project_hash === undefined || parsed.data.project_hash === null
        ? undefined
        : String(parsed.data.project_hash).trim() || undefined
      const issueHash = parsed.data.issue_hash === undefined || parsed.data.issue_hash === null
        ? undefined
        : String(parsed.data.issue_hash).trim() || undefined
      stories.push({ id, hash: e.entity_hash, title, rel, projectHash, issueHash })
    }
  }

  projects.sort(sortByIdNumeric)
  stories.sort(sortByIdNumeric)

  const projectIdByHash = new Map<string, string>()
  for (const p of projects) {
    projectIdByHash.set(p.hash, p.id ?? p.hash.slice(0, 8))
  }

  const rootProjects = projects.filter(p => !p.parentHash)
  const components = projects.filter(p => p.parentHash)

  const out: string[] = []
  out.push('# Blago Workspace Index')
  out.push('')
  out.push(
    '> Сгенерировано автоматически (`blago pull` / `push` / `create` / `del` / `restore`). '
    + 'Не править вручную — будет перезаписано.',
  )
  out.push('')

  out.push('## Проекты')
  if (rootProjects.length === 0) {
    out.push('_(пусто)_')
  }
  else {
    for (const p of rootProjects) {
      out.push(`- **${shortDisplayId(p.id)}** — ${p.title || '(без названия)'} → \`${p.rel}\``)
    }
  }
  out.push('')

  out.push('## Компоненты')
  if (components.length === 0) {
    out.push('_(пусто)_')
  }
  else {
    for (const c of components) {
      const parentLabel = c.parentHash ? projectIdByHash.get(c.parentHash) ?? '?' : '?'
      out.push(`- **${shortDisplayId(c.id)}** — ${c.title || '(без названия)'} (проект ${parentLabel}) → \`${c.rel}\``)
    }
  }
  out.push('')

  out.push('## Требования')
  if (stories.length === 0) {
    out.push('_(пусто)_')
  }
  else {
    for (const s of stories) {
      const ownerLabel = s.projectHash ? projectIdByHash.get(s.projectHash) ?? '?' : '?'
      const issueLabel = s.issueHash ? issueIdByHash.get(s.issueHash) : undefined
      const owner = issueLabel
        ? `задача ${issueLabel} в ${ownerLabel}`
        : `проект/компонент ${ownerLabel}`
      out.push(
        `- **${shortDisplayId(s.id)}** — ${s.title || '(без названия)'} (${owner}) → \`${s.rel}\``,
      )
    }
  }
  out.push('')

  await fs.writeFile(path.join(root, INDEX_MARKDOWN_FILENAME), `${out.join('\n')}`, 'utf8')
}
