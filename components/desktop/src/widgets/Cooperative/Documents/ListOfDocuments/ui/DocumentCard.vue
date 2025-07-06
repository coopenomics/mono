<template lang="pug">
.document-card__container
  q-card.document-card(flat)
    q-card-section(
      :class='{ "cursor-pointer": $q.screen.lt.md }',
      @click='$q.screen.lt.md ? $emit("toggle-expand") : undefined'
    )
      .document-header
        .document-icon
          q-icon(name='fa-solid fa-file-invoice', size='20px', color='primary')
        .document-title
          .title {{ document.statement?.documentAggregate?.rawDocument?.full_title || 'Документ без заголовка' }}
          .subtitle ID: {{ getDocumentHash(document).substring(0, 10) || 'N/A' }}

    q-slide-transition
      div(v-show='expanded')
        q-separator
        q-card-section
          ComplexDocument(:documents='document')

  .card-actions-external
    q-btn(
      flat,
      dense,
      size='sm',
      :icon='expanded ? "expand_less" : "expand_more"',
      @click.stop='$emit("toggle-expand")',
      color='primary',
      round
    )
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import type { IDocumentPackageAggregate } from 'src/entities/Document/model';
import 'src/shared/ui/CardStyles/index.scss';

const $q = useQuasar();

withDefaults(
  defineProps<{
    document: IDocumentPackageAggregate;
    expanded?: boolean;
  }>(),
  {
    expanded: false,
  },
);

defineEmits<{
  (e: 'toggle-expand'): void;
}>();

// Получение хеша документа из агрегата
function getDocumentHash(doc: IDocumentPackageAggregate) {
  if (doc.statement?.documentAggregate?.rawDocument?.hash) {
    return doc.statement.documentAggregate.rawDocument.hash;
  }

  if (doc.decision?.documentAggregate?.rawDocument?.hash) {
    return doc.decision.documentAggregate.rawDocument.hash;
  }

  return 'нет хеша';
}
</script>

<style lang="scss" scoped>
.document-card__container {
  padding: 8px;
  width: 100%;
}

.document-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease-in-out;

  &:hover {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .q-dark & {
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
}

.document-header {
  display: flex;
  align-items: center;

  .document-icon {
    margin-right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .document-title {
    .title {
      font-size: 16px;
      font-weight: 500;
      line-height: 1.2;
    }

    .subtitle {
      font-size: 12px;
      color: var(--q-gray);
      margin-top: 4px;
    }
  }
}

.card-actions-external {
  display: flex;
  justify-content: center;
  padding: 4px;
}
</style>
