// Запись одной сущности при pull: путь, индекс, «грязный» локальный файл.

import type { BlagoEntityType, IndexFile } from './index-store.js'
import * as fs from 'node:fs/promises'

import * as path from 'node:path'
import { sha256Hex } from '../lib/hash.js'

import { warn } from '../ui/output.js'
import { findByHash, normalizeRelativePath, upsertEntry } from './index-store.js'

async function ensureDirForFile(absFile: string): Promise<void> {
  await fs.mkdir(path.dirname(absFile), { recursive: true })
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

/** После переноса файла прибрать пустые родительские каталоги (но не выше rootAbs). */
async function pruneEmptyParents(absFile: string, rootAbs: string): Promise<void> {
  const stopAt = path.resolve(rootAbs)
  let dir = path.resolve(path.dirname(absFile))
  for (let i = 0; i < 16; i++) {
    if (dir === stopAt || !dir.startsWith(`${stopAt}${path.sep}`)) {
      return
    }
    try {
      const entries = await fs.readdir(dir)
      if (entries.length > 0) {
        return
      }
      await fs.rmdir(dir)
    }
    catch {
      return
    }
    dir = path.dirname(dir)
  }
}

async function readFileIfExists(abs: string): Promise<string | null> {
  try {
    return await fs.readFile(abs, 'utf8')
  }
  catch {
    return null
  }
}

/** Маркеры в духе git-merge: правка вручную, затем `blago add` / `blago push`. */
function wrapMergeConflictMarkers(localContent: string, remoteContent: string): string {
  return `<<<<<<< blago/local\n${localContent}\n=======\n${remoteContent}\n>>>>>>> blago/remote\n`
}

/** Один файл сущности: новый путь с сервера vs индекс; «грязный» локально → не затирать без явного сценария. */
export async function syncEntityFile(params: {
  root: string
  index: IndexFile
  entityType: BlagoEntityType
  entityHash: string
  relativePath: string
  content: string
  remoteUpdatedAt: string
  label: string
}): Promise<void> {
  const { root, index, entityType, entityHash, relativePath, content, remoteUpdatedAt, label } = params
  const rel = normalizeRelativePath(relativePath)
  const absNew = path.join(root, rel)
  const prev = findByHash(index, entityType, entityHash)

  if (!prev) {
    await ensureDirForFile(absNew)
    await fs.writeFile(absNew, content, 'utf8')
    const etag = sha256Hex(await fs.readFile(absNew, 'utf8'))
    upsertEntry(index, {
      entity_type: entityType,
      entity_hash: entityHash,
      relative_path: rel,
      remote_updated_at: remoteUpdatedAt,
      content_etag_local: etag,
    })
    return
  }

  const absOld = path.join(root, prev.relative_path)

  if (prev.relative_path !== rel) {
    const oldContent = await readFileIfExists(absOld)
    const dirty
      = oldContent !== null && oldContent !== undefined && sha256Hex(oldContent) !== prev.content_etag_local

    if (dirty) {
      await ensureDirForFile(absNew)
      if (await fileExists(absOld)) {
        await fs.rename(absOld, absNew)
        await pruneEmptyParents(absOld, root)
      }
      else {
        await fs.writeFile(absNew, content, 'utf8')
      }
      upsertEntry(index, {
        entity_type: entityType,
        entity_hash: entityHash,
        relative_path: rel,
        remote_updated_at: remoteUpdatedAt,
        content_etag_local: sha256Hex((await readFileIfExists(absNew)) ?? ''),
      })
      warn(
        `Переименование на сервере: ${label} перенесён на «${rel}» с сохранением локальных правок; проверьте frontmatter (title / updated_at).`,
      )
      return
    }

    await ensureDirForFile(absNew)
    await fs.writeFile(absNew, content, 'utf8')
    if ((await fileExists(absOld)) && path.resolve(absOld) !== path.resolve(absNew)) {
      await fs.unlink(absOld)
      await pruneEmptyParents(absOld, root)
    }
    const etagAfterRename = sha256Hex(await fs.readFile(absNew, 'utf8'))
    upsertEntry(index, {
      entity_type: entityType,
      entity_hash: entityHash,
      relative_path: rel,
      remote_updated_at: remoteUpdatedAt,
      content_etag_local: etagAfterRename,
    })
    return
  }

  const current = await readFileIfExists(absNew)
  const dirty
    = current !== null && current !== undefined && sha256Hex(current) !== prev.content_etag_local
  if (dirty && remoteUpdatedAt !== prev.remote_updated_at) {
    const merged = wrapMergeConflictMarkers(current ?? '', content)
    await ensureDirForFile(absNew)
    await fs.writeFile(absNew, merged, 'utf8')
    const etagConflict = sha256Hex(merged)
    upsertEntry(index, {
      entity_type: entityType,
      entity_hash: entityHash,
      relative_path: rel,
      remote_updated_at: remoteUpdatedAt,
      content_etag_local: etagConflict,
    })
    warn(
      `Конфликт версий для ${label}: в файл записаны маркеры слияния («<<<<<<< blago/local» … «>>>>>>> blago/remote»). Оставьте одну версию текста, удалите маркеры, затем «blago add» и «blago push».`,
    )
    return
  }

  await ensureDirForFile(absNew)
  await fs.writeFile(absNew, content, 'utf8')
  const etagOnDisk = sha256Hex(await fs.readFile(absNew, 'utf8'))
  upsertEntry(index, {
    entity_type: entityType,
    entity_hash: entityHash,
    relative_path: rel,
    remote_updated_at: remoteUpdatedAt,
    content_etag_local: etagOnDisk,
  })
}
