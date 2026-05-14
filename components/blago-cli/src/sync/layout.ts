// slug и пути project.md / component.md / issues / requirements (как GitHub-синк).

import { capitalIdPathPrefix, storyRequirementIdPrefix2 } from '../lib/capital-id-path.js'
import { effectiveParentHash } from '../lib/parent-hash.js'

const transliterationMap: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function hasCyrillic(text: string): boolean {
  return /[а-яё]/i.test(text)
}

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map(char => transliterationMap[char] ?? char)
    .join('')
}

export function generateSlug(title: string): string {
  let processed = title
  if (hasCyrillic(title)) {
    processed = transliterate(title)
  }
  return processed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export interface ProjectPathModel {
  readonly project_hash: string
  readonly title: string
  readonly parent_hash?: string | null
  /** ID проекта/компонента в Capital (блокчейн), для префикса путей */
  readonly capital_id: number
}

export { effectiveParentHash } from '../lib/parent-hash.js'

export function workspaceBasePath(project: ProjectPathModel, projectByHash: ReadonlyMap<string, ProjectPathModel>): string {
  const parentRef = effectiveParentHash(project.parent_hash)
  const slug = generateSlug(project.title || (parentRef ? 'unnamed-component' : 'unnamed-project'))
  const name = `${capitalIdPathPrefix(project.capital_id)}-${slug || (parentRef ? 'unnamed-component' : 'unnamed-project')}`
  if (!parentRef) {
    return name
  }
  const parent = projectByHash.get(parentRef)
  if (!parent) {
    throw new Error(`Родительский проект ${parentRef} не найден для компонента ${project.project_hash}`)
  }
  const parentBase = workspaceBasePath(parent, projectByHash)
  return `${parentBase}/components/${name}`
}

export function projectFileRelativePath(project: ProjectPathModel, projectByHash: ReadonlyMap<string, ProjectPathModel>): string {
  const parentRef = effectiveParentHash(project.parent_hash)
  if (!parentRef) {
    const slug = generateSlug(project.title || 'unnamed-project')
    const name = `${capitalIdPathPrefix(project.capital_id)}-${slug || 'unnamed-project'}`
    return `${name}/project.md`
  }
  const base = workspaceBasePath(project, projectByHash)
  return `${base}/component.md`
}

/** Имя файла: id задачи (PREFIX-N) + slug title — коллизий нет при уникальном id. */
export function issueFileRelativePath(issueTitle: string, basePath: string, issueCapitalId: string): string {
  const slug = generateSlug(issueTitle) || 'issue'
  const idp = capitalIdPathPrefix(issueCapitalId)
  return `${basePath}/issues/${idp}-${slug}.md`
}

export function storyFileRelativePath(
  storyTitle: string,
  basePath: string,
  storyRecordId: string,
  storyHash: string,
  issue?: { readonly id: string, readonly titleSlug: string },
): string {
  const slug = generateSlug(storyTitle) || 'requirement'
  const id2 = storyRequirementIdPrefix2(storyRecordId, storyHash)
  if (issue?.titleSlug) {
    const ip = capitalIdPathPrefix(issue.id)
    return `${basePath}/issue-requirements/${ip}-${issue.titleSlug}/${id2}-${slug}.md`
  }
  return `${basePath}/requirements/${id2}-${slug}.md`
}
