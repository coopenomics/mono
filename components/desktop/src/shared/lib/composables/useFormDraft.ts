import { isRef, onMounted, toRaw, watch, type Ref } from 'vue';

type DraftTarget = Ref<unknown> | Record<string, unknown>;

export interface FormDraftOptions {
  /**
   * Восстановить черновик при монтировании, а не сразу. Нужно страницам под
   * SSR: на сервере localStorage нет, и восстановленное при setup значение на
   * клиенте разошлось бы с серверной разметкой.
   */
  restoreOnMount?: boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasStorage = () => typeof localStorage !== 'undefined';

function readTarget(target: DraftTarget): unknown {
  return isRef(target) ? target.value : toRaw(target);
}

function writeTarget(target: DraftTarget, value: unknown): void {
  if (isRef(target)) {
    // Объект формы мержим поверх дефолтов: старый черновик не должен терять
    // поля, добавленные в форму после его сохранения.
    target.value = isPlainObject(value) && isPlainObject(target.value) ? { ...target.value, ...value } : value;
    return;
  }
  if (isPlainObject(value)) Object.assign(target, value);
}

/**
 * Черновик формы создания в localStorage: закрытое окно, уход со страницы или
 * перезагрузка не теряют введённое — при возврате всё на месте.
 *
 * Каждое поле state (ref или reactive-объект) сериализуется под своим именем;
 * запись — на каждое изменение, стирание — вызовом clearDraft() после
 * успешного создания. Файлы (обложки, вложения) в черновик не попадают:
 * localStorage хранит только текст.
 */
export function useFormDraft(storageKey: string, state: Record<string, DraftTarget>, options: FormDraftOptions = {}) {
  const restoreDraft = () => {
    if (!hasStorage()) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      for (const [name, target] of Object.entries(state)) {
        if (name in saved) writeTarget(target, saved[name]);
      }
    } catch {
      // Битый черновик просто игнорируем — форма стартует пустой
    }
  };

  const saveDraft = () => {
    if (!hasStorage()) return;
    try {
      const snapshot: Record<string, unknown> = {};
      for (const [name, target] of Object.entries(state)) snapshot[name] = readTarget(target);
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // Переполненное хранилище не должно ломать ввод в форму
    }
  };

  const clearDraft = () => {
    if (!hasStorage()) return;
    localStorage.removeItem(storageKey);
  };

  // Запись начинается после восстановления: иначе дефолты формы успели бы
  // перетереть сохранённый черновик.
  const start = () => {
    restoreDraft();
    watch(Object.values(state), saveDraft, { deep: true });
  };

  if (options.restoreOnMount) onMounted(start);
  else start();

  return { clearDraft };
}
