<template lang="pug">
.capital-doc-step
  .capital-doc-step__preview-shell
    .capital-doc-step__toolbar
      BaseButton(
        variant='ghost'
        size='sm'
        :disable='loading'
        @click='emit("refresh")'
      )
        q-icon(name='refresh' size='18px')
        span.q-ml-xs {{ previewHtml ? 'Обновить предпросмотр' : 'Сформировать предпросмотр' }}

    CapitalProgramInlineDocumentPreview(
      v-if='previewHtml && !loading'
      v-model='form'
      :html='previewHtml'
      :field-labels='FIELD_LABELS'
    )

    .capital-doc-step__loading(v-else-if='loading')
      q-spinner(size='36px' color='primary')
      p.t-body-sm.capital-doc-step__loading-text Формируем предпросмотр документа…

    EmptyState(
      v-else
      title='Предпросмотр ещё не сформирован'
      body='Нажмите «Сформировать предпросмотр», чтобы увидеть документ с редактируемыми полями.'
    )
</template>

<script setup lang="ts">
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import CapitalProgramInlineDocumentPreview from './CapitalProgramInlineDocumentPreview.vue';
import { FIELD_LABELS, type EditableFieldKey } from '../model/capitalProgramDocFields';

defineProps<{
  previewHtml: string;
  loading: boolean;
}>();

const form = defineModel<Record<EditableFieldKey, string>>({ required: true });

const emit = defineEmits<{
  refresh: [];
}>();
</script>

<style scoped lang="scss">
.capital-doc-step__preview-shell {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  overflow: hidden;
}

.capital-doc-step__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: var(--p-2) var(--p-3);
  border-bottom: 1px solid var(--p-line);
  background: var(--p-surface-2);
}

.capital-doc-step__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-3);
  min-height: 240px;
  padding: var(--p-6);
}

.capital-doc-step__loading-text {
  margin: 0;
  color: var(--p-ink-2);
}
</style>
