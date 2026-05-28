<template lang="pug">
.document-preview(:style='containerStyle')
  template(v-if='error')
    BaseBanner.document-preview__banner(variant='neg')
      strong Не удалось загрузить документ.
      |  {{ error }}
  template(v-else-if='loading')
    .document-preview__loading
      q-spinner(color='primary' size='28px')
      span.document-preview__loading-text Загрузка документа…
  template(v-else)
    template(v-if='document.type === "html" && safeHtml')
      // eslint-disable-next-line vue/no-v-html
      div.document-preview__html(v-html='safeHtml')
    template(v-else-if='document.type === "pdf" && document.url')
      iframe.document-preview__pdf(
        :src='document.url',
        :title='`PDF превью`'
      )
    template(v-else)
      .document-preview__slot
        slot
          .document-preview__empty
            q-icon(name='description' size='32px')
            span Превью для типа «{{ document.type }}» недоступно
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import type { DocumentPreviewProps } from './DocumentPreview.types';

const props = withDefaults(defineProps<DocumentPreviewProps>(), {
  loading: false,
  sanitize: true,
  height: '480px',
});

const containerStyle = computed(() => ({
  minHeight: typeof props.height === 'number' ? `${props.height}px` : props.height,
}));

const safeHtml = computed((): string => {
  const raw = props.document.html;
  if (!raw) return '';
  return props.sanitize ? DOMPurify.sanitize(raw) : raw;
});
</script>

<style scoped>
.document-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  overflow: hidden;
  color: var(--p-ink);
}

.document-preview__banner {
  margin: var(--p-3, 12px);
}

.document-preview__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  gap: var(--p-3, 12px);
  padding: var(--p-6, 24px);
  color: var(--p-ink-2);
}

.document-preview__loading-text {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.document-preview__html {
  flex: 1 1 auto;
  padding: var(--p-5, 20px);
  overflow: auto;
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink);
}
.document-preview__html :deep(h1),
.document-preview__html :deep(h2),
.document-preview__html :deep(h3) {
  color: var(--p-ink);
  font-weight: 600;
  margin: var(--p-4, 16px) 0 var(--p-2, 8px);
}
.document-preview__html :deep(p) {
  margin: 0 0 var(--p-3, 12px);
}
.document-preview__html :deep(a) {
  color: var(--p-primary);
}
.document-preview__html :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: var(--p-3, 12px) 0;
}
.document-preview__html :deep(th),
.document-preview__html :deep(td) {
  padding: var(--p-2, 8px) var(--p-3, 12px);
  border-bottom: 1px solid var(--p-line);
  vertical-align: top;
}

.document-preview__pdf {
  flex: 1 1 auto;
  width: 100%;
  border: none;
  background: var(--p-surface-2);
}

.document-preview__slot {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.document-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-6, 24px);
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm, 13px);
}
</style>
