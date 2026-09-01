// Кэш карты комнат Matrix: какие комнаты у какого проекта и какие есть вне проектов.
//
// Раньше pull спрашивал список комнат отдельным запросом на КАЖДЫЙ проект — полсотни
// обращений к серверу за данными, которые меняются раз в недели. Кэш живёт сутки;
// принудительно обновляется флагом `--refresh-rooms`.

import * as fs from 'node:fs/promises'

import { blagoDir, roomsCachePath } from '../config/paths.js'

export interface CachedProjectRoom {
  readonly matrixRoomId: string
  readonly displayLabel: string
}

export interface CachedNonProjectRoom extends CachedProjectRoom {
  readonly kind: string
}

export interface RoomsCacheFile {
  /** Момент последнего полного обхода комнат ПРОЕКТОВ (ISO). */
  refreshedAt: string
  /** project_hash → комнаты проекта. Пустой массив — у проекта комнат нет (тоже знание). */
  projectRooms: Record<string, CachedProjectRoom[]>
  /**
   * Момент последнего обхода комнат ВНЕ проектов (ISO). Отдельная отметка обязательна: у двух
   * наборов разные запросы и разные проходы pull. С одной общей отметкой проектный проход
   * помечал кэш свежим, и непроектные комнаты после первого же pull больше не перечитывались —
   * список комнат пайщиков/совета/секретаря навсегда застывал пустым.
   */
  nonProjectRefreshedAt: string
  nonProjectRooms: CachedNonProjectRoom[]
}

/** Срок годности кэша комнат. */
export const ROOMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function empty(): RoomsCacheFile {
  return { refreshedAt: '', projectRooms: {}, nonProjectRefreshedAt: '', nonProjectRooms: [] }
}

export async function loadRoomsCache(root: string): Promise<RoomsCacheFile> {
  try {
    const raw = await fs.readFile(roomsCachePath(root), 'utf8')
    const parsed = JSON.parse(raw) as Partial<RoomsCacheFile>
    return {
      refreshedAt: typeof parsed.refreshedAt === 'string' ? parsed.refreshedAt : '',
      projectRooms:
        parsed.projectRooms !== undefined && typeof parsed.projectRooms === 'object'
          ? { ...parsed.projectRooms }
          : {},
      nonProjectRefreshedAt:
        typeof parsed.nonProjectRefreshedAt === 'string' ? parsed.nonProjectRefreshedAt : '',
      nonProjectRooms: Array.isArray(parsed.nonProjectRooms) ? [...parsed.nonProjectRooms] : [],
    }
  }
  catch {
    return empty()
  }
}

export async function saveRoomsCache(root: string, data: RoomsCacheFile): Promise<void> {
  await fs.mkdir(blagoDir(root), { recursive: true })
  await fs.writeFile(roomsCachePath(root), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function isFresh(refreshedAt: string, now: Date): boolean {
  if (!refreshedAt) {
    return false
  }
  const refreshed = new Date(refreshedAt).getTime()
  if (!Number.isFinite(refreshed)) {
    return false
  }
  return now.getTime() - refreshed < ROOMS_CACHE_TTL_MS
}

/** Годен ли кэш комнат проектов: заполнен и не старше суток. */
export function isRoomsCacheFresh(cache: RoomsCacheFile, now: Date = new Date()): boolean {
  return isFresh(cache.refreshedAt, now)
}

/** Годен ли кэш комнат вне проектов — по своей отметке, независимо от проектного обхода. */
export function isNonProjectRoomsCacheFresh(cache: RoomsCacheFile, now: Date = new Date()): boolean {
  return isFresh(cache.nonProjectRefreshedAt, now)
}
