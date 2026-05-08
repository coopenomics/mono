/**
 * Реестр целевых потребительских программ (ЦПП) для UI.
 *
 * TS-only — контракт оперирует только числовым `program_id`, имена программ
 * это уровень UI/translations. Источник правды для program_id — `soviet::programs`
 * (создаётся при инициализации кооператива), здесь только человекочитаемые
 * метки. Менять метки без миграции контракта.
 *
 * Использование:
 *   - Заголовки колонок в Реестре кошельков (отчёты).
 *   - Заголовки карточек в WalletProgramWidget у пайщика.
 *   - Любые места, где надо вывести «название программы» вместо `program_id`.
 */

export interface ProgramDescriptor {
  /** program_id из soviet::programs (uint64). */
  id: number
  /** Машинное имя для кодопути (matches soviet::programs.program_type). */
  internal_name: string
  /** Краткая метка (1-3 слова) для шапок таблиц и компактных UI. */
  short_label: string
  /** Полное название для карточек/tooltip/хлебных крошек. */
  display_name: string
}

export const LEDGER2_PROGRAMS: readonly ProgramDescriptor[] = [
  { id: 1, internal_name: 'wallet',      short_label: 'ЦК',        display_name: 'ЦПП Цифровой кошелёк' },
  { id: 2, internal_name: 'marketplace', short_label: 'Маркет',    display_name: 'ЦПП Маркетплейс' },
  { id: 3, internal_name: 'generator',   short_label: 'Генератор', display_name: 'ЦПП Генератор' },
  { id: 4, internal_name: 'blagorost',   short_label: 'Благорост', display_name: 'ЦПП Благорост' },
] as const

const programById = new Map<number, ProgramDescriptor>(
  LEDGER2_PROGRAMS.map(p => [p.id, p]),
)

const programByInternalName = new Map<string, ProgramDescriptor>(
  LEDGER2_PROGRAMS.map(p => [p.internal_name, p]),
)

export function getProgramDescriptor(id: number): ProgramDescriptor | null {
  return programById.get(id) ?? null
}

export function getProgramDescriptorByInternalName(name: string): ProgramDescriptor | null {
  return programByInternalName.get(name) ?? null
}

/** Полное название с fallback `Программа №<id>`. Безопасно для unknown id. */
export function getProgramLabel(id: number): string {
  return programById.get(id)?.display_name ?? `Программа №${id}`
}

/** Краткая метка с fallback `№<id>`. Для шапок таблиц. */
export function getProgramShortLabel(id: number): string {
  return programById.get(id)?.short_label ?? `№${id}`
}
