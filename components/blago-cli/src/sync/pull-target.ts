// Разбор аргумента `blago pull <проект>`: id проекта/компонента, путь к каталогу или к .md.

import * as path from 'node:path'

import { isBareProjectCapitalIdToken, resolveProjectMarkerFromCapitalId } from './capital-target-expand.js'
import { loadIndex, normalizeRelativePath } from './index-store.js'
import { resolveProjectHashFromRelativePath } from './resolve-project-hash-from-path.js'

/**
 * Хеш проекта/компонента, к которому относится цель.
 *
 * Принимает то же, что и остальные команды: Capital-id («12»), путь к каталогу workspace
 * или к любому файлу внутри него — берётся ближайший вверх `project.md` / `component.md`.
 */
export async function resolveProjectHashForPull(root: string, target: string): Promise<string> {
  const token = target.trim()
  if (token === '') {
    throw new Error('Пустая цель pull: укажите id проекта/компонента или путь к его каталогу.')
  }

  const index = await loadIndex(root)

  if (isBareProjectCapitalIdToken(token)) {
    const marker = await resolveProjectMarkerFromCapitalId(root, index, token)
    return marker.project_hash
  }

  const abs = path.resolve(root, token)
  const rel = normalizeRelativePath(path.relative(root, abs))
  if (rel === '' || rel.startsWith('..')) {
    throw new Error(`Цель «${target}» вне рабочей копии blago.`)
  }

  // resolveProjectHashFromRelativePath ищет маркер вверх от КАТАЛОГА пути, поэтому для
  // каталога-workspace добавляем фиктивный файл: иначе поиск начнётся с родителя.
  const probeRel = rel.endsWith('.md') ? rel : `${rel}/.`
  const hash = await resolveProjectHashFromRelativePath(root, probeRel)
  if (!hash) {
    throw new Error(
      `Для «${target}» не найден project.md / component.md выше по дереву. Укажите каталог проекта или его id.`,
    )
  }
  return hash
}
