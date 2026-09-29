/**
 * Сочетания клавиш команд рабочего стола.
 *
 * Сочетание команды — две клавиши подряд: ведущая и буква, `N T` — «новая
 * задача». Ведущая клавиша задаёт смысл группы: `N` — создать, `G` — перейти.
 * Одиночные буквы оставлены страницам (в Благоросте `T`, `P` и другие
 * открывают диалоги своей страницы), поэтому ведущие клавиши страницам брать
 * нельзя — иначе команды и страницы начнут перехватывать друг у друга.
 *
 * Клавиши описываются буквами латиницы, а сравниваются по KeyboardEvent.code:
 * сочетание работает в любой раскладке.
 */

/** Ведущие клавиши команд. Страницы не используют их как свои одиночные клавиши. */
export const SHORTCUT_LEADERS = ['N', 'G'] as const;

/** Сколько ждать вторую клавишу после ведущей. */
export const SHORTCUT_SEQUENCE_WINDOW_MS = 1500;

export type ShortcutKeys = readonly [leader: string, key: string];

const KEY_RE = /^[A-Z0-9]$/;

/**
 * Разбирает запись вида `N T`. Неверная запись — `null`: команда остаётся
 * доступной из окна, но без сочетания.
 */
export function parseShortcut(value: string | undefined): ShortcutKeys | null {
  if (!value) return null;
  const keys = value.trim().toUpperCase().split(/\s+/);
  if (keys.length !== 2) return null;
  const [leader, key] = keys;
  if (!(SHORTCUT_LEADERS as readonly string[]).includes(leader)) return null;
  if (!KEY_RE.test(key)) return null;
  return [leader, key];
}

/** Буква или цифра клавиши по KeyboardEvent.code (`KeyT` → `T`, `Digit1` → `1`). */
export function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return null;
}

/** Фокус в поле ввода: набор текста не должен запускать команды. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable="true"]') !== null;
}
