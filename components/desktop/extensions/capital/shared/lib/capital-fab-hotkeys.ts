/**
 * Единые горячие клавиши для действий FAB в расширении «Благорост» (capital).
 * Используются KeyboardEvent.code — не зависят от раскладки клавиатуры.
 * Ведущие клавиши команд рабочего стола (N, G — src/shared/lib/shortcuts)
 * здесь не используются: они начинают сочетания команд.
 */
export const CAPITAL_FAB_HOTKEY_CODES = {
  project: 'KeyP',
  component: 'KeyC',
  issue: 'KeyT',
  requirement: 'KeyR',
  plan: 'KeyF',
  author: 'KeyA',
  invest: 'KeyI',
  join: 'KeyJ',
} as const;

export type CapitalFabHotkeyId = keyof typeof CAPITAL_FAB_HOTKEY_CODES;

/** Короткие подписи для UI (латинские буквы = физическая клавиша) */
export const CAPITAL_FAB_HOTKEY_LABELS: Record<CapitalFabHotkeyId, string> = {
  project: 'P',
  component: 'C',
  issue: 'T',
  requirement: 'R',
  plan: 'F',
  author: 'A',
  invest: 'I',
  join: 'J',
};

/** Подпись пункта FAB: «Название (P)» — буква из {@link CAPITAL_FAB_HOTKEY_LABELS} */
export function formatCapitalFabLabel(
  baseLabel: string,
  id: CapitalFabHotkeyId,
): string {
  return `${baseLabel} (${CAPITAL_FAB_HOTKEY_LABELS[id]})`;
}
