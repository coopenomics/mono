<template lang="pug">
q-card(flat).expandable-document.q-mb-md
  q-expansion-item(
    switch-toggle-side
    :label="title || $t('ui.expandableDocument.defaultTitle')"
    icon="article"
    header-class="document-header"
    expand-icon-class="text-primary"
  )
    q-card
      q-card-section
        div.row.justify-center
          BaseDocument(
            :documentAggregate="documentAggregate"
          ).col-xs-12.col-md-10
</template>

<script setup lang="ts">
import { BaseDocument } from '../BaseDocument'
import type { IDocumentAggregate } from 'src/entities/Document/model'
import { t } from 'src/shared/i18n';

defineProps({
  documentAggregate: {
    type: Object as () => IDocumentAggregate,
    required: true
  },
  title: {
    type: String,
    default: t('ui.expandableDocument.meetDocumentTitle')
  }
})
</script>

<style lang="scss" scoped>
// Волосяная рамка канона: прежний сырой #f0f0f0 в тёмной теме горел яркой
// светлой обводкой вокруг документа.
.expandable-document {
  width: 100%;
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);

  :deep(.document-header) {
    font-weight: 500;
    border-radius: var(--p-r-lg);

    .q-icon {
      color: var(--q-primary);
    }
  }
}
</style>
