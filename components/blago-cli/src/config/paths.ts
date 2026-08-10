// Пути под .blago/ и поиск корня по наличию config.json вверх по дереву.

import * as fs from 'node:fs'
import * as path from 'node:path'

export const BLAGO_DIR = '.blago'
export const GITIGNORE_FILE = '.gitignore'
export const CONFIG_FILE = 'config.json'
export const INDEX_FILE = 'index.json'
export const STAGING_FILE = 'staging.json'
export const PENDING_CREATE_FILE = 'pending-create.json'
export const COMMUNICATION_CURSORS_FILE = 'communication-cursors.json'
export const ROOMS_CACHE_FILE = 'rooms-cache.json'

export function configPath(root: string): string {
  return path.join(root, BLAGO_DIR, CONFIG_FILE)
}

export function indexPath(root: string): string {
  return path.join(root, BLAGO_DIR, INDEX_FILE)
}

export function stagingPath(root: string): string {
  return path.join(root, BLAGO_DIR, STAGING_FILE)
}

export function pendingCreatePath(root: string): string {
  return path.join(root, BLAGO_DIR, PENDING_CREATE_FILE)
}

export function communicationCursorsPath(root: string): string {
  return path.join(root, BLAGO_DIR, COMMUNICATION_CURSORS_FILE)
}

export function roomsCachePath(root: string): string {
  return path.join(root, BLAGO_DIR, ROOMS_CACHE_FILE)
}

export function sessionPath(root: string, envName: string): string {
  return path.join(root, BLAGO_DIR, `session.${envName}.json`)
}

export function blagoDir(root: string): string {
  return path.join(root, BLAGO_DIR)
}

export function gitignorePath(root: string): string {
  return path.join(root, BLAGO_DIR, GITIGNORE_FILE)
}

export function findBlagoRoot(startDir: string): string | null {
  let current = path.resolve(startDir)
  for (;;) {
    const candidate = configPath(current)
    if (fs.existsSync(candidate)) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}
