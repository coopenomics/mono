<template lang="pug">
q-page.documents-page
  ListOfDocumentsWidget(
    :username='coopname',
    :filter='{}',
    :showFilter='false',
    :initialDocumentType='typeForToggle'
  )
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { ListOfDocumentsWidget } from 'src/widgets/Cooperative/Documents/ListOfDocuments/ui';
import { SearchHeaderAction } from 'src/features/DocumentSearch';
import { useHeaderActions } from 'src/shared/hooks';
import type { DocumentType } from 'src/entities/Document/model/types';

const system = useSystemStore();
const { info } = system;
const coopname = computed(() => info.coopname);
const typeForToggle = ref<DocumentType>('newresolved');

const { registerAction } = useHeaderActions();

onMounted(() => {
  const hasSearch = (info as any)?.features?.search === true;
  if (hasSearch) {
    registerAction({
      id: 'document-search',
      component: SearchHeaderAction,
      order: 10,
    });
  }
});
</script>

<style lang="scss" scoped>
/* Поля страницы как в реестре пайщиков — таблица сама обрамлена (.table-wrap) */
.documents-page {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .documents-page {
    padding: var(--p-4, 16px);
  }
}
</style>
