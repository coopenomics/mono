import { watch, type Ref } from 'vue';

const STORAGE_PREFIX = 'capital_form_draft_';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Черновик формы создания в localStorage: случайное закрытие диалога
 * (клик мимо, Esc) не теряет введённое — при повторном открытии всё на месте.
 *
 * Каждый ref из state сериализуется под своим именем; восстановление зовётся
 * сразу при setup (диалог живёт закрытым вместе с кнопкой), запись — на каждое
 * изменение. Черновик стирается вызовом clearDraft() после успешного создания.
 */
export function useFormDraft(key: string, state: Record<string, Ref<unknown>>) {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const restoreDraft = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      for (const [name, target] of Object.entries(state)) {
        if (!(name in saved)) continue;
        const value = saved[name];
        // Объект формы мержим поверх дефолтов: старый черновик не должен
        // терять поля, добавленные в форму после его сохранения
        if (isPlainObject(value) && isPlainObject(target.value)) {
          target.value = { ...target.value, ...value };
        } else {
          target.value = value;
        }
      }
    } catch {
      // Битый черновик просто игнорируем — форма стартует пустой
    }
  };

  const saveDraft = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      const snapshot: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(state)) {
        snapshot[name] = source.value;
      }
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // Переполненное хранилище не должно ломать ввод в форму
    }
  };

  const clearDraft = () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(storageKey);
  };

  restoreDraft();
  watch(Object.values(state), saveDraft, { deep: true });

  return { clearDraft };
}
