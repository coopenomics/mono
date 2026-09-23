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
.expandable-document {
  width: 100%;
  border: 1px solid #f0f0f0;
  border-radius: 8px;

  :deep(.document-header) {
    font-weight: 500;
    border-radius: 8px;

    .q-icon {
      color: var(--q-primary);
    }
  }
}
</style>
