<template lang="pug">
.capital-inline-doc.statement(ref='containerRef')
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import type { EditableFieldKey } from '../model/capitalProgramDocFields';

const props = defineProps<{
  html: string;
  fieldLabels: Partial<Record<EditableFieldKey, string>>;
}>();

const form = defineModel<Record<EditableFieldKey, string>>({ required: true });

const containerRef = ref<HTMLElement | null>(null);
const listeners = new WeakMap<HTMLTextAreaElement, () => void>();

type FocusSnapshot = {
  key: EditableFieldKey;
  selectionStart: number;
  selectionEnd: number;
};

let focusSnapshot: FocusSnapshot | null = null;

function isFieldEmpty(key: EditableFieldKey): boolean {
  return !String(form.value[key] ?? '').trim();
}

function applyFieldStyle(textarea: HTMLTextAreaElement, key: EditableFieldKey) {
  textarea.classList.toggle('capital-doc-param-inline--empty', isFieldEmpty(key));
}

function captureFocus() {
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement) || !active.classList.contains('capital-doc-param-inline')) {
    focusSnapshot = null;
    return;
  }

  const key = active.getAttribute('data-field') as EditableFieldKey | null;
  if (!key) {
    focusSnapshot = null;
    return;
  }

  focusSnapshot = {
    key,
    selectionStart: active.selectionStart,
    selectionEnd: active.selectionEnd,
  };
}

function restoreFocus(root: HTMLElement) {
  if (!focusSnapshot) return;

  const textarea = root.querySelector(`textarea[data-field="${focusSnapshot.key}"]`) as HTMLTextAreaElement | null;
  if (!textarea) return;

  textarea.focus();
  textarea.setSelectionRange(focusSnapshot.selectionStart, focusSnapshot.selectionEnd);
}

function cleanupEditors(root: HTMLElement) {
  root.querySelectorAll('textarea.capital-doc-param-inline').forEach((node) => {
    const textarea = node as HTMLTextAreaElement;
    const handler = listeners.get(textarea);
    if (handler) {
      textarea.removeEventListener('input', handler);
      listeners.delete(textarea);
    }
  });
}

function mountInlineEditors(root: HTMLElement) {
  root.querySelectorAll('[data-doc-param]').forEach((node) => {
    const key = node.getAttribute('data-doc-param') as EditableFieldKey | null;
    if (!key) return;

    const textarea = document.createElement('textarea');
    textarea.className = 'capital-doc-param-inline';
    textarea.setAttribute('data-field', key);
    textarea.rows =
      key.includes('description') ||
      key.includes('expansion') ||
      key.includes('development') ||
      key.includes('goal') ||
      key.includes('purpose')
        ? 3
        : 2;
    textarea.value = form.value[key] ?? '';
    textarea.placeholder = props.fieldLabels[key] ?? key;
    applyFieldStyle(textarea, key);

    const onInput = () => {
      form.value[key] = textarea.value;
      applyFieldStyle(textarea, key);
    };
    textarea.addEventListener('input', onInput);
    listeners.set(textarea, onInput);

    node.replaceWith(textarea);
  });
}

function syncInlineEditors(root: HTMLElement) {
  root.querySelectorAll('textarea.capital-doc-param-inline').forEach((node) => {
    const textarea = node as HTMLTextAreaElement;
    const key = textarea.getAttribute('data-field') as EditableFieldKey | null;
    if (!key) return;

    if (textarea !== document.activeElement && textarea.value !== (form.value[key] ?? '')) {
      textarea.value = form.value[key] ?? '';
    }

    applyFieldStyle(textarea, key);
  });
}

async function renderDocument(html: string) {
  await nextTick();
  const root = containerRef.value;
  if (!root) return;

  captureFocus();
  cleanupEditors(root);
  root.innerHTML = DOMPurify.sanitize(html);
  mountInlineEditors(root);
  restoreFocus(root);
}

watch(
  () => props.html,
  (html) => {
    if (html) void renderDocument(html);
  },
  { immediate: true },
);

watch(
  form,
  () => {
    if (containerRef.value) syncInlineEditors(containerRef.value);
  },
  { deep: true },
);

onBeforeUnmount(() => {
  if (containerRef.value) cleanupEditors(containerRef.value);
});
</script>

<style scoped lang="scss">
.capital-inline-doc {
  max-height: 60vh;
  overflow: auto;
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}

.capital-inline-doc :deep(.capital-doc-param-inline) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: var(--p-1) 0;
  padding: var(--p-2) var(--p-3);
  font: inherit;
  line-height: inherit;
  color: var(--p-ink);
  background: color-mix(in srgb, var(--p-primary) 8%, var(--p-surface));
  border: 1px dashed var(--p-primary);
  border-radius: var(--p-r-sm);
  resize: vertical;
  box-sizing: border-box;
  white-space: pre-wrap;

  &:focus {
    outline: none;
    border-style: solid;
    background: color-mix(in srgb, var(--p-primary) 12%, var(--p-surface));
  }

  &::placeholder {
    color: var(--p-ink-muted);
    font-size: 0.85em;
  }
}

.capital-inline-doc :deep(.capital-doc-param-inline--empty) {
  border-color: var(--p-warn);
  background: color-mix(in srgb, var(--p-warn) 12%, var(--p-surface));

  &:focus {
    background: color-mix(in srgb, var(--p-warn) 16%, var(--p-surface));
  }
}
</style>
