<template lang="pug">
.document-row(
  :class='{ "document-row--clickable": clickable }',
  :role='clickable ? "button" : undefined',
  :tabindex='clickable ? 0 : undefined',
  @click='onActivate',
  @keydown.enter='onActivate',
  @keydown.space.prevent='onActivate'
)
  .document-row__icon(:class='`document-row__icon--${document.type}`')
    q-icon(:name='iconFor(document.type)' size='20px')
  .document-row__body
    .document-row__title-row
      span.document-row__title {{ document.title }}
      BaseBadge(v-if='document.status', :variant='statusVariant') {{ statusLabel }}
    .document-row__meta(v-if='hasMeta')
      span.document-row__date(v-if='document.date') {{ document.date }}
      span.document-row__author(v-if='document.author') {{ document.author }}
      span.document-row__desc(v-if='document.description') {{ document.description }}
  .document-row__actions(v-if='$slots.actions', @click.stop)
    slot(name='actions')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import type { DocumentRowProps, DocumentStatus, DocumentType } from './DocumentRow.types';

const props = withDefaults(defineProps<DocumentRowProps>(), {
  clickable: true,
});

const emit = defineEmits<{
  open: [];
}>();

const STATUS_VARIANT: Record<DocumentStatus, 'pos' | 'neg' | 'warn' | 'neutral'> = {
  signed: 'pos',
  rejected: 'neg',
  pending: 'warn',
  draft: 'neutral',
};
const STATUS_LABEL: Record<DocumentStatus, string> = {
  signed: 'Подписано',
  rejected: 'Отклонено',
  pending: 'Ожидает',
  draft: 'Черновик',
};

const statusVariant = computed(() => props.document.status ? STATUS_VARIANT[props.document.status] : 'neutral');
const statusLabel = computed(() => props.document.status ? STATUS_LABEL[props.document.status] : '');

const hasMeta = computed((): boolean => {
  const d = props.document;
  return Boolean(d.date || d.author || d.description);
});

function iconFor(t: DocumentType): string {
  switch (t) {
    case 'pdf': return 'picture_as_pdf';
    case 'docx': return 'description';
    case 'html': return 'code';
    case 'txt': return 'article';
    case 'image': return 'image';
  }
}

function onActivate(): void {
  if (props.clickable) emit('open');
}
</script>

<style scoped>
.document-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}

.document-row--clickable {
  cursor: pointer;
}
.document-row--clickable:hover {
  background: var(--p-surface-2);
  border-color: var(--p-line-2);
}
.document-row--clickable:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}

.document-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-surface-3);
  color: var(--p-ink-1);
}
.document-row__icon--pdf {
  background: var(--p-neg-soft);
  color: var(--p-neg);
}
.document-row__icon--docx {
  background: var(--p-info-soft);
  color: var(--p-info);
}
.document-row__icon--html {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
.document-row__icon--txt,
.document-row__icon--image {
  background: var(--p-surface-3);
  color: var(--p-ink-2);
}

.document-row__body {
  min-width: 0;
}

.document-row__title-row {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}

.document-row__title {
  font-weight: 600;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}

.document-row__meta {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  flex-wrap: wrap;
  margin-top: var(--p-1, 4px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.document-row__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
}
</style>
