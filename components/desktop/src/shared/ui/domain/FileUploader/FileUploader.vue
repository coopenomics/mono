<template lang="pug">
.file-uploader
  .file-uploader__drop(
    :class='{ "file-uploader__drop--dragover": isDragOver, "file-uploader__drop--disabled": disabled }',
    @click='openPicker',
    @dragover.prevent='onDragOver',
    @dragleave.prevent='onDragLeave',
    @drop.prevent='onDrop',
    role='button',
    tabindex='0',
    @keydown.enter='openPicker',
    @keydown.space.prevent='openPicker'
  )
    q-icon.file-uploader__icon(name='cloud_upload', size='28px')
    .file-uploader__title {{ title ?? 'Перетащите файлы или нажмите для выбора' }}
    .file-uploader__hint(v-if='resolvedHint') {{ resolvedHint }}
    input.file-uploader__native(
      ref='inputRef',
      type='file',
      :accept='accept',
      :multiple='multiple',
      :disabled='disabled',
      @change='onPick'
    )
  .file-uploader__list(v-if='files.length')
    .file-uploader__item(v-for='(f, idx) in files', :key='`${f.name}-${idx}`')
      q-icon.file-uploader__item-icon(:name='iconFor(f)', size='20px')
      .file-uploader__item-body
        .file-uploader__item-name {{ f.name }}
        .file-uploader__item-meta
          span {{ formatSize(f.size) }}
          span(v-if='f.type') · {{ f.type }}
      .file-uploader__item-progress(v-if='$slots.progress')
        slot(name='progress', :file='f', :index='idx')
      button.file-uploader__item-remove(
        type='button',
        :aria-label='`Удалить ${f.name}`',
        @click='removeAt(idx)'
      )
        q-icon(name='close', size='16px')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FileUploaderError, FileUploaderProps } from './FileUploader.types';

const props = withDefaults(defineProps<FileUploaderProps>(), {
  multiple: false,
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: File | File[] | null];
  error: [error: FileUploaderError];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);

const files = computed<File[]>(() => {
  const v = props.modelValue;
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
});

const resolvedHint = computed((): string => {
  if (props.hint) return props.hint;
  const parts: string[] = [];
  if (props.accept) parts.push(`Форматы: ${props.accept}`);
  if (props.maxSize) parts.push(`до ${formatSize(props.maxSize)}`);
  if (props.maxFiles && props.multiple) parts.push(`не более ${props.maxFiles} файлов`);
  return parts.join(' · ');
});

function openPicker(): void {
  if (props.disabled) return;
  inputRef.value?.click();
}

function onDragOver(event: DragEvent): void {
  if (props.disabled) return;
  isDragOver.value = true;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function onDragLeave(): void {
  isDragOver.value = false;
}

function onDrop(event: DragEvent): void {
  isDragOver.value = false;
  if (props.disabled) return;
  const list = event.dataTransfer?.files;
  if (!list || !list.length) return;
  applyFiles(Array.from(list));
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement;
  const list = input.files;
  if (!list || !list.length) return;
  applyFiles(Array.from(list));
  input.value = '';
}

function applyFiles(picked: File[]): void {
  const accepted: File[] = [];
  for (const f of picked) {
    if (props.accept && !matchesAccept(f, props.accept)) {
      emit('error', { code: 'accept', file: f, message: `Тип файла не разрешён: ${f.name}` });
      continue;
    }
    if (props.maxSize && f.size > props.maxSize) {
      emit('error', { code: 'max-size', file: f, message: `Файл больше ${formatSize(props.maxSize)}: ${f.name}` });
      continue;
    }
    accepted.push(f);
  }
  if (!accepted.length) return;

  if (!props.multiple) {
    emit('update:modelValue', accepted[0] ?? null);
    return;
  }
  const merged = [...files.value, ...accepted];
  if (props.maxFiles && merged.length > props.maxFiles) {
    emit('error', { code: 'max-files', message: `Можно загрузить не более ${props.maxFiles} файлов` });
    emit('update:modelValue', merged.slice(0, props.maxFiles));
    return;
  }
  emit('update:modelValue', merged);
}

function removeAt(index: number): void {
  if (!props.multiple) {
    emit('update:modelValue', null);
    return;
  }
  const next = files.value.filter((_, i) => i !== index);
  emit('update:modelValue', next);
}

function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept.split(',').map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.some((token) => {
    if (token.startsWith('.')) {
      return file.name.toLowerCase().endsWith(token.toLowerCase());
    }
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, -1);
      return file.type.startsWith(prefix);
    }
    return file.type === token;
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} КБ`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} МБ`;
  return `${(mb / 1024).toFixed(1)} ГБ`;
}

function iconFor(f: File): string {
  const t = f.type;
  if (t.startsWith('image/')) return 'image';
  if (t === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'picture_as_pdf';
  if (/\.docx?$/i.test(f.name)) return 'description';
  if (/\.xlsx?$/i.test(f.name)) return 'grid_on';
  if (/\.zip$|\.tar$|\.gz$/i.test(f.name)) return 'folder_zip';
  return 'insert_drive_file';
}
</script>

<style scoped>
.file-uploader {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.file-uploader__drop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-2, 8px);
  padding: var(--p-6, 24px);
  border: 1px dashed var(--p-line-2);
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface);
  color: var(--p-ink-2);
  text-align: center;
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), border-color var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.file-uploader__drop:hover {
  background: var(--p-surface-2);
  border-color: var(--p-primary);
  color: var(--p-ink);
}
.file-uploader__drop:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
  border-color: var(--p-primary);
}
.file-uploader__drop--dragover {
  background: var(--p-primary-soft);
  border-color: var(--p-primary);
  color: var(--p-primary);
}
.file-uploader__drop--disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.file-uploader__icon {
  color: var(--p-primary);
}

.file-uploader__title {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  color: var(--p-ink);
}

.file-uploader__hint {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
  color: var(--p-ink-3);
}

.file-uploader__native {
  display: none;
}

.file-uploader__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.file-uploader__item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-2, 8px) var(--p-3, 12px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  color: var(--p-ink);
}

.file-uploader__item-icon {
  color: var(--p-ink-2);
}

.file-uploader__item-body {
  min-width: 0;
}

.file-uploader__item-name {
  font-size: var(--p-fs-body, 14px);
  font-weight: 500;
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-uploader__item-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3);
}

.file-uploader__item-progress {
  min-width: 120px;
}

.file-uploader__item-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  border-radius: var(--p-r-sm, 8px);
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.file-uploader__item-remove:hover {
  background: var(--p-neg-soft);
  color: var(--p-neg);
}
</style>
