<template>
  <div
    class="easymde-editor-container"
    :class="{
      'easymde-editor--readonly': readonly,
      'easymde-editor--dark': isDark,
      'easymde-editor--padded': padded,
      'easymde-editor--focused': showFocusRing && isFocused,
    }"
    :style="editorContainerStyle"
  >
    <div ref="editorRef" class="milkdown-editor-root"></div>
    <div v-if="error" class="easymde-editor-error">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
  computed,
  getCurrentInstance,
} from 'vue';
import type { Crepe } from '@milkdown/crepe';
import { CrepeFeature } from '@milkdown/crepe';
import { sanitizeEditorMarkdown } from 'src/shared/lib/utils/sanitizeEditorMarkdown';
import { crepeMermaidRenderPreview } from './crepeMermaidRenderPreview';

interface Props {
  modelValue: string | null | undefined;
  readonly?: boolean;
  placeholder?: string;
  minHeight?: number;
  padded?: boolean;
  /** Рамка при фокусе — для полей внутри форм рядом с q-input и т.п. На полноэкранных страницах описания — false */
  showFocusRing?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'ready'): void;
  (e: 'change'): void;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  placeholder: 'Начните писать...',
  minHeight: 0,
  padded: true,
  showFocusRing: false,
});

const emit = defineEmits<Emits>();

const instance = getCurrentInstance();
const quasar = instance?.proxy as { $q?: { dark?: { isActive: boolean } } } | undefined;
const isDark = computed(() => quasar?.$q?.dark?.isActive ?? false);

const editorContainerStyle = computed(() => {
  if (!props.minHeight) return {};
  return { minHeight: `${props.minHeight}px` };
});

const editorRef = ref<HTMLDivElement>();
const crepeRef = ref<Crepe>();
const error = ref<string>('');
const isMounted = ref(false);
const isDestroyed = ref(false);
const isUpdating = ref(false);
const isInternalChange = ref(false);
const isFocused = ref(false);

const initEditor = async (initialMarkdown?: string) => {
  if (typeof window === 'undefined') return;
  if (!editorRef.value) return;
  if (crepeRef.value || isDestroyed.value) return;

  isMounted.value = true;

  try {
    await import('@milkdown/crepe/theme/common/style.css');
    /*
     * Не импортируем frame.css / frame-dark.css по очереди: оба задают .milkdown { --crepe-* },
     * второй импорт остаётся в документе — после светлой темы тёмная не возвращалась.
     * Палитра задаётся в <style> от .easymde-editor-container; CodeMirror в Crepe тоже берёт фон из --crepe-*.
     */
    const { Crepe } = await import('@milkdown/crepe');
    const markdown = sanitizeEditorMarkdown(initialMarkdown ?? props.modelValue ?? '');

    const editor = new Crepe({
      root: editorRef.value,
      defaultValue: markdown,
      featureConfigs: {
        placeholder: {
          text: props.placeholder,
          mode: 'block',
        },
        [CrepeFeature.CodeMirror]: {
          copyText: 'Копировать',
          renderPreview: crepeMermaidRenderPreview(isDark.value),
          /* Сначала превью (mermaid и т.д.), код — по «Редактировать»; «Только превью» — обратно. */
          previewOnlyByDefault: true,
          previewToggleText: (previewOnly: boolean) =>
            previewOnly ? 'Редактировать' : 'Только превью',
        },
      },
    });

    editor.on((listener) => {
      listener.markdownUpdated((_ctx, md) => {
        if (props.readonly || !isMounted.value || isDestroyed.value || isUpdating.value) return;
        const cleaned = sanitizeEditorMarkdown(md);
        try {
          if (cleaned === md) {
            isInternalChange.value = true;
            emit('update:modelValue', md);
            emit('change');
            nextTick(() => {
              isInternalChange.value = false;
            });
          } else {
            emit('update:modelValue', cleaned);
            emit('change');
          }
        } catch (e) {
          isInternalChange.value = false;
          console.error('Editor markdown sync failed:', e);
        }
      });
      listener.focus(() => {
        if (!props.readonly) isFocused.value = true;
      });
      listener.blur(() => {
        isFocused.value = false;
      });
    });

    await editor.create();
    crepeRef.value = editor;

    if (props.readonly) {
      editor.setReadonly(true);
    }

    emit('ready');
    console.log('Milkdown (Crepe) editor created');
  } catch (err) {
    error.value = 'Ошибка инициализации редактора';
    console.error('Milkdown initialization failed:', err);
    isMounted.value = false;
  }
};

const destroyEditor = async () => {
  if (!crepeRef.value || isDestroyed.value) return;
  isDestroyed.value = true;
  try {
    await crepeRef.value.destroy();
    console.log('Milkdown editor destroyed');
  } catch (err) {
    console.error('Editor destruction failed:', err);
  } finally {
    crepeRef.value = undefined;
    isMounted.value = false;
  }
};

watch(
  () => props.modelValue,
  async (newValue) => {
    if (isInternalChange.value) return;
    if (!crepeRef.value || !isMounted.value || isDestroyed.value || isUpdating.value) return;

    try {
      isUpdating.value = true;
      const incoming = sanitizeEditorMarkdown(newValue ?? '');
      const currentValue = crepeRef.value.getMarkdown();
      if (incoming !== currentValue) {
        await destroyEditor();
        isDestroyed.value = false;
        await nextTick();
        await initEditor(incoming);
      }
    } catch (err) {
      console.error('Failed to update editor content:', err);
    } finally {
      isUpdating.value = false;
    }
  },
);

watch(
  () => props.readonly,
  (newReadonly) => {
    if (!crepeRef.value || !isMounted.value || isDestroyed.value) return;
    try {
      crepeRef.value.setReadonly(newReadonly);
    } catch (err) {
      console.error('Failed to toggle readonly mode:', err);
    }
  },
);

watch(
  () => props.placeholder,
  async () => {
    if (!crepeRef.value || !isMounted.value || isDestroyed.value) return;
    try {
      const currentValue = crepeRef.value.getMarkdown();
      await destroyEditor();
      isDestroyed.value = false;
      await nextTick();
      await initEditor(currentValue);
    } catch (err) {
      console.error('Failed to update placeholder:', err);
    }
  },
);

watch(
  isDark,
  async () => {
    if (!crepeRef.value || !isMounted.value || isDestroyed.value) return;
    try {
      const currentValue = crepeRef.value.getMarkdown();
      await destroyEditor();
      isDestroyed.value = false;
      await nextTick();
      await initEditor(currentValue);
    } catch (err) {
      console.error('Failed to switch theme:', err);
    }
  },
  { flush: 'post' },
);

onMounted(() => {
  void nextTick(async () => {
    await initEditor();
  });
});

onBeforeUnmount(() => {
  void destroyEditor();
});

defineExpose({
  getData: () => {
    if (!crepeRef.value || !isMounted.value || isDestroyed.value) {
      console.warn('Editor not initialized');
      return null;
    }
    try {
      return sanitizeEditorMarkdown(crepeRef.value.getMarkdown());
    } catch (err) {
      console.error('Failed to get editor data:', err);
      return null;
    }
  },
  clear: () => {
    void (async () => {
      if (!crepeRef.value || !isMounted.value || isDestroyed.value) {
        emit('update:modelValue', '');
        return;
      }
      try {
        await destroyEditor();
        isDestroyed.value = false;
        await nextTick();
        await initEditor('');
        emit('update:modelValue', '');
      } catch (err) {
        console.error('Failed to clear editor:', err);
      }
    })();
  },
});
</script>

<style>
.easymde-editor-container {
  padding: 4px;
  position: relative;
  z-index: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.easymde-editor-container .milkdown {
  max-width: 100%;
  min-width: 0;
  /* Фон наследуется от подложки страницы/диалога: белый блок crepe-темы
     выбивался из канвы (канон: поверхности задаёт страница, не редактор) */
  background: transparent;
}

/*
 * Палитра Crepe (копия frame / frame-dark) привязана к контейнеру редактора, а не к глобальному .milkdown
 * из динамических импортов — иначе при переключении светлая тема «залипала» из-за порядка таблиц стилей.
 */
.easymde-editor-container:not(.easymde-editor--dark) .milkdown {
  --crepe-color-background: #ffffff;
  --crepe-color-on-background: #000000;
  --crepe-color-surface: #f7f7f7;
  --crepe-color-surface-low: #ededed;
  --crepe-color-on-surface: #1c1c1c;
  --crepe-color-on-surface-variant: #4d4d4d;
  --crepe-color-outline: #a8a8a8;
  --crepe-color-primary: #333333;
  --crepe-color-secondary: #cfcfcf;
  --crepe-color-on-secondary: #000000;
  --crepe-color-inverse: #f0f0f0;
  --crepe-color-on-inverse: #1a1a1a;
  --crepe-color-inline-code: #ba1a1a;
  --crepe-color-error: #ba1a1a;
  --crepe-color-hover: #e0e0e0;
  --crepe-color-selected: #d5d5d5;
  --crepe-color-inline-area: #cacaca;
  /* Канон-инвариант: Inter + JetBrains Mono, никаких serif/Noto/Space Mono */
  --crepe-font-title: var(--p-sans);
  --crepe-font-default: var(--p-sans);
  --crepe-font-code: var(--p-mono);
  --crepe-shadow-1:
    0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3);
  --crepe-shadow-2:
    0px 2px 6px 2px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3);
}

.easymde-editor-container.easymde-editor--dark .milkdown {
  --crepe-color-background: #1a1a1a;
  --crepe-color-on-background: #e6e6e6;
  --crepe-color-surface: #121212;
  --crepe-color-surface-low: #1c1c1c;
  --crepe-color-on-surface: #d1d1d1;
  --crepe-color-on-surface-variant: #a9a9a9;
  --crepe-color-outline: #757575;
  --crepe-color-primary: #b5b5b5;
  --crepe-color-secondary: #4d4d4d;
  --crepe-color-on-secondary: #d6d6d6;
  --crepe-color-inverse: #e5e5e5;
  --crepe-color-on-inverse: #2a2a2a;
  --crepe-color-inline-code: #ff6666;
  --crepe-color-error: #ff6666;
  --crepe-color-hover: #232323;
  --crepe-color-selected: #2f2f2f;
  --crepe-color-inline-area: #2b2b2b;
  /* Канон-инвариант: Inter + JetBrains Mono, никаких serif/Noto/Space Mono */
  --crepe-font-title: var(--p-sans);
  --crepe-font-default: var(--p-sans);
  --crepe-font-code: var(--p-mono);
  --crepe-shadow-1:
    0px 1px 2px 0px rgba(255, 255, 255, 0.3),
    0px 1px 3px 1px rgba(255, 255, 255, 0.15);
  --crepe-shadow-2:
    0px 1px 2px 0px rgba(255, 255, 255, 0.3),
    0px 2px 6px 2px rgba(255, 255, 255, 0.15);
}

.easymde-editor-container.easymde-editor--focused {
  border-color: var(--q-primary);
  box-shadow: 0 0 4px var(--q-primary);
}

.easymde-editor-error {
  color: #d32f2f;
  font-size: 14px;
  margin-top: 8px;
  padding: 0 16px;
}

.milkdown-editor-root {
  position: relative;
  z-index: 0;
  max-width: 100%;
  min-width: 0;
}

.easymde-editor-container .milkdown .ProseMirror {
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: auto;
  outline: none;
}

/* Таблицы и прочий контент с intrinsic min-width не расширяют внешнюю рамку */
.easymde-editor-container .milkdown .ProseMirror table {
  max-width: 100%;
}

.easymde-editor-container .milkdown .ProseMirror td,
.easymde-editor-container .milkdown .ProseMirror th {
  word-break: break-word;
}

/*
 * Crepe: div.milkdown-code-block + CodeMirror 6.
 * В baseTheme у .cm-content стоит flexShrink: 0 + min-width:auto у flex-элементов —
 * длинная строка задаёт intrinsic min-width и раздувает ProseMirror/колонку.
 * Лечение: жёсткая ширина 100% у cm-editor/cm-scroller + min-width:0 на цепочке (как у flex overflow).
 */
.easymde-editor-container .milkdown .milkdown-code-block {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  contain: inline-size;
}

/* Обёртка с ref, куда appendChild(cm.dom) — иначе % у .cm-editor не от чего считаться */
.easymde-editor-container .milkdown .milkdown-code-block div:has(> .cm-editor) {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
}

.easymde-editor-container .milkdown .milkdown-code-block .cm-editor {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: hidden !important;
}

.easymde-editor-container .milkdown .milkdown-code-block .cm-scroller {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow-x: auto !important;
  overflow-y: auto !important;
}

/* Перебиваем min-size:auto у flex-ребёнка (.cm-content в baseTheme с flexShrink: 0) */
.easymde-editor-container .milkdown .milkdown-code-block .cm-content {
  min-width: 0 !important;
}

/*
 * Пока открыт CodeMirror, панель превью скрыта (режим правки кода). В режиме «только превью»
 * (по умолчанию при previewOnlyByDefault) редактор скрыт — видно превью.
 */
.easymde-editor-container
  .milkdown
  .milkdown-code-block:has(.codemirror-host:not(.hidden))
  .preview-panel {
  display: none !important;
}

/* Обычный fenced code (pre), если встретится вне CodeMirror-node */
.easymde-editor-container .milkdown .ProseMirror pre {
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  box-sizing: border-box;
}

.easymde-editor-container .milkdown .ProseMirror pre code {
  white-space: pre;
  word-break: normal;
}

.easymde-editor-container .milkdown .ProseMirror:focus,
.easymde-editor-container .milkdown .ProseMirror:focus-visible {
  outline: none;
}

/* Левая ручка «+» / drag — не используем, slash-меню оставляем */
.easymde-editor-container .milkdown .milkdown-block-handle {
  display: none !important;
}

/* Slash-меню: без полупрозрачности и с непрозрачным фоном */
.easymde-editor-container .milkdown .milkdown-slash-menu {
  opacity: 1 !important;
}

.body--light .easymde-editor-container .milkdown .milkdown-slash-menu {
  background: #f7f7f7 !important;
}

.body--dark .easymde-editor-container .milkdown .milkdown-slash-menu,
.easymde-editor-container.easymde-editor--dark .milkdown .milkdown-slash-menu {
  background: #2a2a2a !important;
}

.easymde-editor-container.easymde-editor--padded .milkdown .ProseMirror {
  padding: 0 14px !important;
}

.easymde-editor-container:not(.easymde-editor--padded) .milkdown .ProseMirror {
  padding: 0 !important;
}

@media (max-width: 768px) {
  .easymde-editor-container .milkdown .ProseMirror {
    padding: 0 !important;
  }
}

.body--dark .easymde-editor-container .milkdown,
.easymde-editor-container.easymde-editor--dark .milkdown {
  background: transparent;
  color: #d4d4d4;
}

/* Mermaid: превью в панели code block (DOMPurify пропускает SVG) */
.easymde-editor-container .milkdown .milkdown-code-block .preview svg {
  max-width: 100%;
  height: auto;
  display: block;
}

.easymde-editor-container .milkdown .editor-mermaid-preview-error {
  margin: 8px 0;
  color: #c62828;
  font-size: 13px;
}

.body--dark .easymde-editor-container .milkdown .editor-mermaid-preview-error,
.easymde-editor-container.easymde-editor--dark .milkdown .editor-mermaid-preview-error {
  color: #ef9a9a;
}
</style>
