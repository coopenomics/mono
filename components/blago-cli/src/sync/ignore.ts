// .blagoignore: простые префиксы/имена (не полный gitignore). К DEFAULT_IGNORE см. loadBlagoIgnoreRules.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/** Всегда: служебные каталоги + маркер «текущий проект» + автогенерируемый INDEX.md (см. workspace-index). */
const DEFAULT_IGNORE = ['.blago/', '.git/', 'current_project.md', 'INDEX.md']

/** Каталоги BMAD: не документы Capital — не заходим при рекурсии add/remove и не индексируем по любому пути. */
const SYNC_SKIP_DIR_SEGMENTS = new Set(['_bmad', '_bmad_output', '_bmad-output'])

export function isBlagoSyncExcludedDirName(dirName: string): boolean {
  return SYNC_SKIP_DIR_SEGMENTS.has(dirName)
}

export function relativePathHasBlagoSyncExcludedSegment(relPosix: string): boolean {
  const n = relPosix.replace(/\\/g, '/')
  for (const part of n.split('/')) {
    if (part !== '' && SYNC_SKIP_DIR_SEGMENTS.has(part)) {
      return true
    }
  }
  return false
}

export async function loadBlagoIgnoreRules(root: string): Promise<string[]> {
  const rules: string[] = [...DEFAULT_IGNORE]
  try {
    const raw = await fs.readFile(path.join(root, '.blagoignore'), 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) {
        continue
      }
      rules.push(t)
    }
  }
  catch {
    /* нет файла */
  }
  return rules
}

function matchesRule(relPosix: string, rule: string): boolean {
  const r = rule.replace(/\\/g, '/')
  const withSlash = r.endsWith('/') ? r.slice(0, -1) : r
  if (relPosix === withSlash) {
    return true
  }
  if (relPosix.startsWith(`${withSlash}/`)) {
    return true
  }
  if (!r.includes('/')) {
    const parts = relPosix.split('/')
    return parts.includes(withSlash)
  }
  return false
}

export function isIgnoredRelativePath(relPosix: string, rules: string[]): boolean {
  if (relativePathHasBlagoSyncExcludedSegment(relPosix)) {
    return true
  }
  for (const rule of rules) {
    if (matchesRule(relPosix, rule)) {
      return true
    }
  }
  return false
}
