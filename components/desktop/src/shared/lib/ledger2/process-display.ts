import { Ledger2 } from 'cooptypes'
import { formatAsset2Digits } from 'src/shared/lib/utils'

/**
 * Единые helper'ы отображения процесса ledger2 (цвет/метка/формат) — общие для
 * реестра процессов (стол бухгалтера) и реестра заказов (стол администратора),
 * чтобы карта цветов и человекочитаемые подписи жили в одном месте, а не
 * копировались по страницам.
 */

export interface ProcessColorEntry {
  /** Акцент левой полосы заголовка детализации (сырой hex — это палитра процесса, не токен темы). */
  accent: string
  /** Цвет фона чипа (Quasar color-name). */
  chipBg: string
  /** Цвет текста чипа (Quasar color-name). */
  chipText: string
}

// Цвет процесса определяется контрактом-источником (reg/wal/cap/mkt/sov/mig/adj).
const PROCESS_COLORS: Record<string, ProcessColorEntry> = {
  reg: { accent: '#1976d2', chipBg: 'blue-1', chipText: 'blue-9' },
  wal: { accent: '#00796b', chipBg: 'teal-1', chipText: 'teal-9' },
  cap: { accent: '#5e35b1', chipBg: 'deep-purple-1', chipText: 'deep-purple-9' },
  mkt: { accent: '#ef6c00', chipBg: 'orange-1', chipText: 'orange-9' },
  sov: { accent: '#5d4037', chipBg: 'brown-1', chipText: 'brown-9' },
  mig: { accent: '#616161', chipBg: 'grey-3', chipText: 'grey-9' },
  adj: { accent: '#ef6c00', chipBg: 'amber-2', chipText: 'amber-10' },
}
const PROCESS_COLOR_DEFAULT: ProcessColorEntry = {
  accent: '#9e9e9e',
  chipBg: 'grey-3',
  chipText: 'grey-9',
}

export function processColorEntry(type: string | null | undefined): ProcessColorEntry {
  if (!type) return PROCESS_COLOR_DEFAULT
  const parts = type.split('.')
  const contract = parts.length >= 3 ? parts[1] : parts[0]
  return PROCESS_COLORS[contract ?? ''] ?? PROCESS_COLOR_DEFAULT
}
export function processAccentColor(type: string | null | undefined): string {
  return processColorEntry(type).accent
}
export function processChipBg(type: string | null | undefined): string {
  return processColorEntry(type).chipBg
}
export function processChipText(type: string | null | undefined): string {
  return processColorEntry(type).chipText
}

export function processTypeLabel(type: string | null | undefined): string {
  if (!type) return '—'
  return Ledger2.getProcessHumanName(type) ?? type
}

/**
 * Человекочитаемое название операции. Запись apply несёт operation_code;
 * корректировки walmove/revert его не несут — название берётся по action через
 * тот же реестр операций.
 */
export function operationLabel(
  row: { operationCode?: string | null; action?: string | null },
): string {
  if (row.operationCode) {
    return Ledger2.getOperationHumanName(row.operationCode) ?? row.operationCode
  }
  if (row.action === 'walmove') {
    return Ledger2.getOperationHumanName('o.adj.walmove') ?? 'Перевод между кошельками'
  }
  if (row.action === 'revert') {
    return Ledger2.getOperationHumanName('o.adj.rev') ?? 'Откат операции'
  }
  return '—'
}

// id счёта хранится ×1000 — к UI-коду приводим целочисленным делением (51000 → 51).
export function accountCodeFromId(id: number | null | undefined): number | null {
  return id != null ? Math.round(id / 1000) : null
}

export function formatProcessAmount(qty: string | null | undefined): string {
  if (!qty) return '—'
  return formatAsset2Digits(qty)
}
