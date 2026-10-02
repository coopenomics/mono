import { onMounted, onUnmounted } from 'vue';
import {
  SHORTCUT_LEADERS,
  SHORTCUT_SEQUENCE_WINDOW_MS,
  isEditableTarget,
  keyFromCode,
  type ShortcutKeys,
} from './keys';

export interface ShortcutBinding {
  keys: ShortcutKeys;
  run: () => void;
}

/**
 * Слушает сочетания команд на всём рабочем столе: ведущая клавиша, затем буква.
 *
 * Слушатель стоит на фазе перехвата: вторая клавиша сочетания не доходит до
 * одиночных клавиш страницы (в Благоросте `T` открывает диалог задачи на своей
 * странице, а `N T` — команда стола, и сработать должно одно). Набор текста,
 * клавиши с Ctrl, ⌘ или Alt и автоповтор не трогаются.
 */
export function useCommandShortcuts(getBindings: () => ShortcutBinding[]): void {
  if (typeof window === 'undefined') return;

  let leader: string | null = null;
  let leaderAt = 0;

  const swallow = (e: KeyboardEvent): void => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const isIgnored = (e: KeyboardEvent): boolean =>
    e.ctrlKey || e.metaKey || e.altKey || e.repeat || isEditableTarget(e.target);

  const isLeader = (key: string): boolean =>
    (SHORTCUT_LEADERS as readonly string[]).includes(key) && getBindings().some((b) => b.keys[0] === key);

  /** Вторая клавиша после ведущей: запускает команду, если сочетание найдено. */
  const completeSequence = (e: KeyboardEvent, key: string): boolean => {
    const pending = leader && Date.now() - leaderAt <= SHORTCUT_SEQUENCE_WINDOW_MS ? leader : null;
    leader = null;
    const binding = pending && getBindings().find((b) => b.keys[0] === pending && b.keys[1] === key);
    if (!binding) return false;
    swallow(e);
    binding.run();
    return true;
  };

  /**
   * Ведущая клавиша ждёт вторую, только если на неё есть хоть одна команда:
   * иначе одиночная клавиша страницы с той же буквой не должна пропадать.
   */
  const startSequence = (e: KeyboardEvent, key: string): void => {
    if (!isLeader(key)) return;
    leader = key;
    leaderAt = Date.now();
    swallow(e);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isIgnored(e)) return;
    const key = keyFromCode(e.code);
    if (!key) return;
    if (!completeSequence(e, key)) startSequence(e, key);
  };

  onMounted(() => window.addEventListener('keydown', onKeyDown, true));
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown, true));
}
