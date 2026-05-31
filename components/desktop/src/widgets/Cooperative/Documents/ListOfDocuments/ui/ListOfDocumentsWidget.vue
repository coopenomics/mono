<template lang="pug">
//- Реестр по умолчанию — канон карточки/плоские строки с переходом на страницу
//- документа. Режим таблицы с инлайн-раскрытием (expand=true) оставлен для
//- Union-страницы, где документы чужого кооператива смотрят на месте.
DocumentCardsList(
  v-if='!expand',
  :documents='documentStore.documents',
  :loading='documentStore.loading',
  :pagination='documentStore.pagination',
  @load='loadMoreDocuments'
)

DocumentsTable(
  v-else,
  :documents='documentStore.documents',
  :loading='documentStore.loading',
  :pagination='documentStore.pagination',
  @toggle-expand='toggleExpand',
  @load='loadMoreDocuments'
)
  template(#top, v-if='showFilter')
    .full-width
      q-btn-toggle.full-width(
        size='sm',
        :model-value='typeForToggle',
        @update:model-value='onTypeChange',
        spread,
        unelevated,
        toggle-color='primary',
        :options='[ { label: "Все входящие", value: "newsubmitted" }, { label: "Только утверждённые", value: "newresolved" }, ]'
      )
</template>

<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue';
import { DocumentModel } from 'src/entities/Document';
import { DocumentsTable, DocumentCardsList } from '../ui';
import { FailAlert } from 'src/shared/api';
import type { DocumentType } from 'src/entities/Document/model/types';

const props = defineProps({
  username: {
    type: String,
    required: true,
  },
  filter: {
    type: Object,
    required: false,
    default: () => ({}),
  },
  showFilter: {
    type: Boolean,
    required: false,
    default: false,
  },
  // Режим таблицы с инлайн-раскрытием документа (для Union-страницы).
  // По умолчанию — карточки с переходом на отдельную страницу документа.
  expand: {
    type: Boolean,
    required: false,
    default: false,
  },
  initialDocumentType: {
    type: String as () => DocumentType,
    required: false,
    default: 'newsubmitted',
  },
});

const emit = defineEmits(['toggle-expand']);

// Получаем store документов
const documentStore = DocumentModel.useDocumentStore();

// Переменная для отслеживания типа в интерфейсе
const typeForToggle = ref<DocumentType>(props.initialDocumentType);

// Обработчик изменения типа документов
async function onTypeChange(newType: DocumentType) {
  if (newType === 'newresolved' || newType === 'newsubmitted') {
    typeForToggle.value = newType;
    try {
      await documentStore.changeDocumentType(
        newType,
        props.username,
        props.filter,
      );
    } catch (e) {
      FailAlert(e);
    }
  }
}

// Функция для загрузки следующей страницы документов
async function loadMoreDocuments() {
  try {
    // Проверяем, не загружаются ли уже документы
    if (documentStore.loading) {
      return;
    }

    const nextPage = documentStore.pagination.currentPage + 1;

    if (nextPage <= documentStore.pagination.totalPages)
      await documentStore.changePage(nextPage, props.username, props.filter);
  } catch (e) {
    FailAlert(e);
  }
}

// Функция для переключения состояния раскрытия
function toggleExpand(document: any) {
  emit('toggle-expand', document);
}

// Периодическое обновление данных
let interval: number | null = null;

// Загрузка документов при монтировании
onMounted(() => {
  // Начальная загрузка документов
  documentStore.resetDocuments();
  documentStore
    .changeDocumentType(typeForToggle.value, props.username, props.filter)
    .catch((e) => FailAlert(e));
});

// Очистка таймера при размонтировании компонента
onBeforeUnmount(() => {
  if (interval !== null) {
    window.clearInterval(interval);
  }
});
</script>
