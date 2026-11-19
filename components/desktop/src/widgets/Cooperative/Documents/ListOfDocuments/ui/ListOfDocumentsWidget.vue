<template lang="pug">
//- Реестр по умолчанию — канон карточки/плоские строки с переходом на страницу
//- документа. Режим таблицы с инлайн-раскрытием (expand=true) оставлен для
//- Union-страницы, где документы чужого кооператива смотрят на месте.
//- Панель журнала (стол совета): вид выдачи — пакеты процессов либо каждый
//- документ отдельно, период по дате подписи и тип документа.
.documents-journal(v-if='journal && !expand')
  BaseSegmented.documents-journal__view(
    :model-value='documentStore.listOptions.view'
    :options='viewOptions'
    :aria-label='$t("cooperative.listOfDocumentsWidget.viewAriaLabel")'
    @update:model-value='setView'
  )
  BaseInput.documents-journal__date(
    type='date'
    :label='$t("cooperative.listOfDocumentsWidget.signedFromLabel")'
    :model-value='documentStore.listOptions.signed_from'
    clearable
    @update:model-value='(value) => applyOptions({ signed_from: value ? String(value) : null })'
  )
  BaseInput.documents-journal__date(
    type='date'
    :label='$t("cooperative.listOfDocumentsWidget.signedToLabel")'
    :model-value='documentStore.listOptions.signed_to'
    clearable
    @update:model-value='(value) => applyOptions({ signed_to: value ? endOfDay(String(value)) : null })'
  )
  //- Подпись над значением, как у дат; окно выбора постоянной ширины — при
  //- поиске по типам оно не меняет размер.
  BaseSelect.documents-journal__type(
    :label='$t("cooperative.listOfDocumentsWidget.typeLabel")'
    :placeholder='$t("cooperative.listOfDocumentsWidget.typeAll")'
    stack-label
    :popup-content-style='{ width: "min(560px, 90vw)" }'
    :options='typeOptions'
    :model-value='documentStore.listOptions.registry_ids[0] ?? null'
    searchable
    clearable
    @update:model-value='(value) => applyOptions({ registry_ids: value == null ? [] : [Number(value)] })'
  )

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
        :options='[ { label: $t("cooperative.listOfDocumentsWidget.allIncomingOption"), value: "newsubmitted" }, { label: $t("cooperative.listOfDocumentsWidget.onlyApprovedOption"), value: "newresolved" }, ]'
      )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Registry } from '@coopenomics/docs-templates';
import { BaseInput, BaseSegmented, BaseSelect } from 'src/shared/ui/base';
import type { IDocumentListOptions } from 'src/entities/Document/model/store';
import { t } from 'src/shared/i18n';
import { DocumentModel } from 'src/entities/Document';
import { DocumentsTable, DocumentCardsList } from '../ui';
import { FailAlert } from 'src/shared/api';
import type { DocumentType } from 'src/entities/Document/model/types';
import { useLiveReload } from 'src/shared/lib/realtime';

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
  // Панель журнала: вид выдачи, период подписи, тип документа (стол совета).
  journal: {
    type: Boolean,
    required: false,
    default: false,
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

const viewOptions = computed(() => [
  { value: 'PACKAGE', label: t('cooperative.listOfDocumentsWidget.viewPackage') },
  { value: 'FLAT', label: t('cooperative.listOfDocumentsWidget.viewFlat') },
]);

// Типы документов — реестр шаблонов фабрики, по алфавиту.
const typeOptions = computed(() =>
  Object.values(Registry as Record<string, { registry_id?: number; title?: string }>)
    .filter((entry) => typeof entry?.registry_id === 'number' && !!entry.title)
    .map((entry) => ({ value: entry.registry_id as number, label: entry.title as string }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
);

/** Конец выбранного дня: период «по» включает весь день. */
function endOfDay(date: string): string {
  return `${date}T23:59:59`;
}

/** Переключатель вида отдаёт значение выбранного варианта — один из видов журнала. */
function setView(view: string | number): void {
  void applyOptions({ view: view as IDocumentListOptions['view'] });
}

async function applyOptions(options: Partial<IDocumentListOptions>): Promise<void> {
  try {
    await documentStore.setListOptions(options, props.username, props.filter);
  } catch (e) {
    FailAlert(e);
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

// Загрузка документов при монтировании
onMounted(() => {
  // Начальная загрузка документов. Без панели журнала (реестр пайщика) — пакетный
  // вид без фильтров: вид, выбранный на столе совета, в реестр пайщика не переносится.
  if (!props.journal) {
    documentStore.listOptions = { view: 'PACKAGE', signed_from: null, signed_to: null, registry_ids: [] };
  }
  documentStore.resetDocuments();
  documentStore
    .changeDocumentType(typeForToggle.value, props.username, props.filter)
    .catch((e) => FailAlert(e));
});

// Живой реестр: подписанный документ, решение совета и аннулирование пишут
// реестр узла signed_documents — показанные страницы перечитываются сами.
useLiveReload([{ code: 'core', table: 'signed_documents' }], () =>
  documentStore.reloadLoaded(props.username, props.filter),
);
</script>

<style scoped>
/* Элементы — по верхнему краю: под полями место для подсказки, по нижнему
   краю переключатель съезжал ниже полей. */
.documents-journal {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--p-3);
  margin-bottom: var(--p-2);
}
/* Переключатель вида — высотой поля (плотное поле с рамкой — 40px). */
.documents-journal__view {
  height: 40px;
}
.documents-journal__view :deep(button) {
  min-height: 0;
  height: 100%;
  padding-top: 0;
  padding-bottom: 0;
}
.documents-journal__date {
  width: 180px;
}
.documents-journal__type {
  flex: 1 1 260px;
  min-width: 220px;
}
</style>
