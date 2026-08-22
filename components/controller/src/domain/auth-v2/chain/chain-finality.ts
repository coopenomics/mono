/**
 * Финализация активного ключа COOPOS (CoopID, Story 9.6, finalized-only reads).
 *
 * Чтения ключа должны опираться только на финализированное (необратимое) состояние:
 * смена ключа в реверсивном блоке может быть откачена chain reorg. Здесь — чистая
 * проверка: не позже ли граница LIB, чем время последнего изменения active-permission.
 */

/** Подмножество get_info, нужное для оценки границы финализации. */
export interface ChainHeadInfo {
  head_block_num: number;
  head_block_time: string;
  last_irreversible_block_num: number;
  /** Точное время LIB-блока, если узел его отдаёт (иначе оценим по head). */
  last_irreversible_block_time?: string;
}

export interface FinalityOptions {
  /** Запас к границе LIB (мс): требуем last_updated ≤ времени_LIB − запас. */
  marginMs: number;
  /** Интервал блока цепи (мс) — для оценки времени LIB, когда узел его не отдаёт. */
  blockIntervalMs: number;
}

/**
 * Время LIB-блока в ms epoch: точное (last_irreversible_block_time), иначе оценка
 * `head_block_time − (head − LIB) × интервал_блока`. null — данных недостаточно.
 */
export function libBlockTimeMs(info: ChainHeadInfo, blockIntervalMs: number): number | null {
  if (info.last_irreversible_block_time) {
    const exact = Date.parse(info.last_irreversible_block_time);
    return Number.isFinite(exact) ? exact : null;
  }
  const head = Date.parse(info.head_block_time);
  if (!Number.isFinite(head)) return null;
  if (!Number.isFinite(info.head_block_num) || !Number.isFinite(info.last_irreversible_block_num)) return null;
  const lag = info.head_block_num - info.last_irreversible_block_num;
  if (lag < 0) return null;
  return head - lag * blockIntervalMs;
}

/**
 * Финализировано ли последнее изменение active-permission (его `last_updated`).
 *
 * Возвращает `true` (пропускаем как финализированное), если данных для строгой
 * проверки нет — нет `last_updated` (старые ноды/моки) или не вычислить время LIB.
 * Честную НЕ-финализацию (`false`) определяем только когда обе величины известны:
 * требуем `last_updated ≤ времени_LIB − запас` (запас компенсирует оценку времени LIB).
 */
export function isActivePermissionFinalized(
  lastUpdatedIso: string | undefined | null,
  info: ChainHeadInfo,
  opts: FinalityOptions,
): boolean {
  if (!lastUpdatedIso) return true;
  const lastUpdatedMs = Date.parse(lastUpdatedIso);
  if (!Number.isFinite(lastUpdatedMs)) return true;
  const libMs = libBlockTimeMs(info, opts.blockIntervalMs);
  if (libMs === null) return true;
  return lastUpdatedMs <= libMs - opts.marginMs;
}
