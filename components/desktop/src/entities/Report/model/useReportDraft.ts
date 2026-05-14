import { computed, onMounted, ref } from 'vue';
import { useReportStore } from './store';
import type { IFieldError, IReportType } from '../types';

export interface UseReportDraftOptions {
  /** Debounce-интервал автосейва в мс (default 500). */
  debounceMs?: number;
  /** Автозагрузка drafta при монтировании (default true). */
  autoLoad?: boolean;
}

/**
 * Composable для редактируемого состояния формы отчёта.
 *
 * Использование:
 * ```ts
 * const { edits, markDirty, isSaving } = useReportDraft<BuhotchEdits>(
 *   'BUHOTCH', 2026, undefined,
 * );
 * // в шаблоне:
 * // <q-input :model-value="edits.organization.inn"
 * //          @update:model-value="v => { edits.organization.inn = v; markDirty('organization.inn') }" />
 * ```
 *
 * При первом рендере делает `buildInitialReportEdits` — получает дефолты с
 * наложенным dirty-мёрджем. При каждом `markDirty(path)` добавляет path в
 * `editedFields` и запускает debounced `saveReportDraft` (default 500мс).
 *
 * Путь — точечный JSONPath без массивов (`organization.inn`,
 * `balance.assetsTotal.otch`). Массивы в edits-DTO пока не используются
 * (ПСВ с перечнем ФИО — отдельный случай, решим при её реализации).
 */
export function useReportDraft<TEdits>(
  reportType: IReportType,
  year: number,
  period?: number | null,
  options?: UseReportDraftOptions,
) {
  const debounceMs = options?.debounceMs ?? 500;
  const autoLoad = options?.autoLoad ?? true;

  const store = useReportStore();

  const edits = ref<TEdits | null>(null) as { value: TEdits | null };
  const editedFields = ref<Set<string>>(new Set());
  const draftId = ref<string | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isValidating = ref(false);
  const lastSavedAt = ref<Date | null>(null);
  const hasDraft = computed(() => draftId.value !== null);

  /**
   * Серверные ошибки валидации per-поле, ключ = JSONPath (совпадает с
   * editedFields). Каждое поле может иметь несколько сообщений (например,
   * length + regex). Форма через v-if/hint достаёт по path и подсвечивает.
   */
  const fieldErrors = ref<Record<string, string[]>>({});
  const isValid = computed(() => Object.keys(fieldErrors.value).length === 0);

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveInFlight: Promise<void> | null = null;
  let validateTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Перечитать edits с сервера (с применённым dirty-мёрджем).
   * Вызывать при монтировании или когда нужно «подтянуть ончейн-изменения».
   */
  async function load(): Promise<void> {
    isLoading.value = true;
    fieldErrors.value = {};
    try {
      const initial = await store.buildInitialEdits(reportType, year, period ?? null);
      if (!initial) return;
      edits.value = JSON.parse(initial.editsJson) as TEdits;
      editedFields.value = new Set(initial.editedFields);
      if (initial.hasDraft) {
        // draft.id нужен для последующего delete. Отдельный запрос — цена
        // за независимость buildInitialReportEdits от id-semantics.
        const draft = await store.getDraft(reportType, year, period ?? null);
        draftId.value = draft?.id ?? null;
      } else {
        draftId.value = null;
      }
      // Сразу валидируем — чтобы незаполненные реквизиты подсвечивались
      // при открытии формы, а не только после первого ввода.
      await validateNow();
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Пометить поле как отредактированное пользователем и запустить
   * debounced автосейв. Вызывать ВСЕГДА после `edits.value.xxx = new`.
   */
  function markDirty(path: string): void {
    if (!editedFields.value.has(path)) {
      // Immutable-replacement: Set.add не триггерит реактивность в Vue.
      editedFields.value = new Set([...editedFields.value, path]);
    }
    // Сбрасываем серверные ошибки по этому полю — пользователь его правит,
    // следующий validate покажет актуальное состояние. Без сброса подсветка
    // красного держится до ответа сервера (~600мс), что раздражает.
    if (fieldErrors.value[path]) {
      const next = { ...fieldErrors.value };
      delete next[path];
      fieldErrors.value = next;
    }
    scheduleSave();
    scheduleValidate();
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveNow();
    }, debounceMs);
  }

  function scheduleValidate(): void {
    if (validateTimer) clearTimeout(validateTimer);
    validateTimer = setTimeout(() => {
      void validateNow();
    }, debounceMs);
  }

  /**
   * Запросить валидацию текущего состояния edits с сервера. Обновляет
   * `fieldErrors` — map{path → [messages]}. Вызывается автоматически после
   * каждого markDirty через debounce; можно вызвать явно перед генерацией.
   */
  async function validateNow(): Promise<IFieldError[]> {
    if (!edits.value) return [];
    if (validateTimer) {
      clearTimeout(validateTimer);
      validateTimer = null;
    }
    isValidating.value = true;
    try {
      const errors = await store.validateEdits(reportType, JSON.stringify(edits.value));
      const map: Record<string, string[]> = {};
      for (const err of errors) {
        if (!map[err.path]) map[err.path] = [];
        map[err.path].push(err.message);
      }
      fieldErrors.value = map;
      return errors;
    } finally {
      isValidating.value = false;
    }
  }

  /**
   * Немедленный сейв (минует дебаунс). Полезен перед `generateFromEdits`
   * чтобы гарантировать что сервер знает последнее состояние формы.
   */
  async function saveNow(): Promise<void> {
    if (!edits.value) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // Конкурентные saveNow: ждём текущий inflight, потом делаем новый.
    if (saveInFlight) await saveInFlight;

    isSaving.value = true;
    const currentEdits = edits.value;
    const currentFields = [...editedFields.value];
    saveInFlight = (async () => {
      try {
        const saved = await store.saveDraft({
          reportType,
          year,
          period: period ?? null,
          editsJson: JSON.stringify(currentEdits),
          editedFields: currentFields,
        });
        if (saved?.id) draftId.value = saved.id;
        lastSavedAt.value = new Date();
      } finally {
        isSaving.value = false;
        saveInFlight = null;
      }
    })();
    await saveInFlight;
  }

  /**
   * Перегенерировать edits со стороны сервера — dirty-поля сохранятся,
   * автоподсчётные (balance по ledger2, реквизиты) обновятся свежими.
   */
  async function regenerate(): Promise<void> {
    await load();
  }

  /**
   * Удалить черновик (если сохранён) и очистить dirty-трекер.
   * edits остаются в памяти — чтобы пользователь не потерял контекст.
   */
  async function clear(): Promise<void> {
    if (draftId.value) {
      await store.deleteDraft(draftId.value);
      draftId.value = null;
    }
    editedFields.value = new Set();
  }

  if (autoLoad) {
    onMounted(() => {
      void load();
    });
  }

  return {
    edits,
    editedFields,
    fieldErrors,
    isValid,
    isLoading,
    isSaving,
    isValidating,
    lastSavedAt,
    hasDraft,
    load,
    markDirty,
    saveNow,
    validateNow,
    regenerate,
    clear,
  };
}
