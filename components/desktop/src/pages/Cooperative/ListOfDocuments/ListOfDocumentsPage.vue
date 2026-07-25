<template lang="pug">
//- Родитель реестра: деталь документа — child (подсветка «Реестр документов» в matched).
router-view(v-if='!isDocumentsRoot')
q-page.documents-page(v-else)
  ListOfDocumentsWidget(
    :username='coopname',
    :filter='{}',
    :showFilter='false',
    :initialDocumentType='typeForToggle'
  )
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { ListOfDocumentsWidget } from 'src/widgets/Cooperative/Documents/ListOfDocuments/ui';
import { SearchHeaderAction } from 'src/features/DocumentSearch';
import { useHeaderActions } from 'src/shared/hooks';
import type { DocumentType } from 'src/entities/Document/model/types';

const route = useRoute();
const system = useSystemStore();
const { info } = system;
const coopname = computed(() => info.coopname);
const isDocumentsRoot = computed(() => route.name === 'documents');
// «Все входящие» (newsubmitted) → status не ограничивается → совет видит ВСЕ документы кооператива
// (submitted + resolved), как и пайщик в своём реестре. Переключатель скрыт (showFilter=false),
// поэтому это и есть итоговая выборка реестра совета.
const typeForToggle = ref<DocumentType>('newsubmitted');

const { registerAction, clearActions } = useHeaderActions();

function registerSearchAction(): void {
  const hasSearch = (info as { features?: { search?: boolean } })?.features?.search === true;
  if (!hasSearch) return;
  registerAction({
    id: 'document-search',
    component: SearchHeaderAction,
    order: 10,
  });
}

onMounted(() => {
  if (isDocumentsRoot.value) registerSearchAction();
});

watch(isDocumentsRoot, (isRoot) => {
  if (isRoot) registerSearchAction();
  else clearActions();
});

onBeforeUnmount(() => {
  clearActions();
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
