<template lang="pug">
//- Вкладки раздела: подписанные документы кооператива и шаблоны документов
//- с их редакциями и утверждением советом. На странице отдельного документа
//- полоса не нужна.
//- Активная вкладка задаётся явно: маршрут шаблонов вложен в маршрут реестра,
//- и по `route.matched` таб «Документы» считал бы себя активным вместе с
//- «Шаблонами» — подсвечивались оба, а клик по «Документам» глотался.
PageTabs(v-if='showTabs', :tabs='tabs', :active-key='isTemplates ? "templates" : "documents"', hoist)
//- Родитель реестра: деталь документа и вкладка шаблонов — child
//- (подсветка «Реестр документов» в matched).
router-view(v-if='!isDocumentsRoot', @changed='loadAttention')
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
import { PageTabs, type PageTab } from 'src/shared/ui/layout/PageTabs';
import { documentTemplatesApi, DOCUMENT_TEMPLATES_LIVE_TABLES } from 'src/pages/Cooperative/DocumentTemplates';
import { useLiveReload } from 'src/shared/lib/realtime';
import type { DocumentType } from 'src/entities/Document/model/types';
import { t } from 'src/shared/i18n';

const route = useRoute();
const system = useSystemStore();
const { info } = system;
const coopname = computed(() => info.coopname);
const isDocumentsRoot = computed(() => route.name === 'documents');
const isTemplates = computed(() => route.name === 'document-templates');
const showTabs = computed(() => isDocumentsRoot.value || isTemplates.value);

// Счётчик на вкладке шаблонов: документы, ждущие решения совета. Считает
// сервер, чтобы вкладку не забывали, пока есть неутверждённые редакции.
const attention = ref(0);
const loadAttention = async () => {
  if (!coopname.value) return;
  try {
    attention.value = await documentTemplatesApi.loadDocumentTemplatesAttention(coopname.value);
  } catch {
    attention.value = 0;
  }
};

// Счётчик живёт по тем же таблицам, что и реестр шаблонов.
useLiveReload(DOCUMENT_TEMPLATES_LIVE_TABLES, loadAttention);

const tabs = computed((): PageTab[] => [
  { key: 'documents', label: t('cooperative.listOfDocumentsPage.documentsTab'), routeName: 'documents' },
  { key: 'templates', label: t('cooperative.listOfDocumentsPage.templatesTab'), routeName: 'document-templates', count: attention.value || undefined },
]);
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
  void loadAttention();
});

watch(coopname, (cn) => {
  if (cn) void loadAttention();
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
