<template lang="pug">
.document-cards
  //- Загрузка — канон-скелетоны (не спиннер).
  .document-cards__list(v-if='loading && !documents.length')
    span.skel.document-cards__skel(v-for='i in 5', :key='i')

  .document-cards__list(v-else-if='documents.length')
    DocumentRow(
      v-for='doc in sortedDocuments',
      :key='getDocumentHash(doc)',
      :document='toRowDoc(doc)',
      @open='openDocument(getDocumentHash(doc))'
    )
      template(#actions)
        button.icon-btn(
          type='button',
          aria-label='Скачать пакет',
          :disabled='downloadingPackages.get(packageKey(doc))',
          @click='downloadPackage(doc)'
        )
          q-icon(name='download')

  EmptyState(
    v-else,
    title='Документы не найдены',
    body='Здесь появятся ваши документы и подписанные соглашения.'
  )
    template(#icon)
      q-icon(name='description', size='48px')

  .document-cards__foot(v-if='documents.length')
    span.document-cards__range {{ rangeLabel }}
    BaseButton(
      v-if='hasMore',
      variant='ghost',
      size='sm',
      :loading='loading',
      @click='$emit("load")'
    ) Загрузить ещё
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import { DocumentRow } from 'src/shared/ui/domain/DocumentRow';
import type { DocumentRowDoc } from 'src/shared/ui/domain/DocumentRow';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { FailAlert } from 'src/shared/api';
import {
  prepareDocumentPackageArchive,
  getSignersListFromDocumentPackage,
} from 'src/shared/lib/document';
import { DocumentModel } from 'src/entities/Document';
import type { IDocumentPackageAggregate } from 'src/entities/Document/model';

interface IPagination {
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

const props = defineProps<{
  documents: IDocumentPackageAggregate[];
  loading: boolean;
  pagination?: IPagination;
}>();

defineEmits<{
  (e: 'load'): void;
}>();

const { openDocument } = DocumentModel.useDocumentNavigation();

const downloadingPackages = reactive(new Map<string, boolean>());

// Метаданные документа (распарсенный объект) — из заявления или решения.
function getMeta(row: IDocumentPackageAggregate): Record<string, any> | undefined {
  return (
    (row.statement?.documentAggregate?.document?.meta as any) ||
    (row.decision?.documentAggregate?.document?.meta as any) ||
    undefined
  );
}

// Чистое наименование — из meta.title; запасной вариант — full_title.
function getDocumentTitle(row: IDocumentPackageAggregate): string {
  return (
    getMeta(row)?.title ||
    row.statement?.documentAggregate?.rawDocument?.full_title ||
    row.decision?.documentAggregate?.rawDocument?.full_title ||
    'Документ без заголовка'
  );
}

function getDocumentDate(row: IDocumentPackageAggregate): string {
  return getMeta(row)?.created_at || '';
}

// block_num монотонно растёт со временем — надёжный ключ хронологической сортировки.
function getBlockNum(row: IDocumentPackageAggregate): number {
  return Number(getMeta(row)?.block_num ?? 0);
}

// Хеш ПОДПИСАННОГО документа — колонка `hash` в реестре, по ней бэкенд фильтрует
// при загрузке одного документа (UPPER(d.hash) = UPPER(:hash)) и её же отдаёт поиск.
// ВНИМАНИЕ: rawDocument.hash — это doc_hash (хеш содержимого), он НЕ совпадает с
// колонкой hash, поэтому для навигации берём именно document.hash.
function getDocumentHash(row: IDocumentPackageAggregate): string {
  return (
    row.statement?.documentAggregate?.document?.hash ||
    row.decision?.documentAggregate?.document?.hash ||
    ''
  );
}

function getSigners(row: IDocumentPackageAggregate): string[] {
  return getSignersListFromDocumentPackage(row);
}

// Маппинг агрегата в канон-строку документа. Статус НЕ передаём: в реестре всё
// подписано по определению — чип «Подписано/Не подписано» запрещён каноном.
function toRowDoc(row: IDocumentPackageAggregate): DocumentRowDoc {
  const signers = getSigners(row);
  return {
    type: 'pdf',
    title: getDocumentTitle(row),
    date: getDocumentDate(row) || undefined,
    author: signers.length ? signers.join(', ') : undefined,
  };
}

// Свежие документы сверху (по block_num).
const sortedDocuments = computed(() =>
  [...props.documents].sort((a, b) => getBlockNum(b) - getBlockNum(a)),
);

const hasMore = computed(
  () => (props.pagination?.currentPage ?? 1) < (props.pagination?.totalPages ?? 1),
);

const rangeLabel = computed(() => {
  const total = props.pagination?.totalCount ?? props.documents.length;
  const shown = props.documents.length;
  return shown ? `1–${shown} из ${total}` : `0 из ${total}`;
});

// Ключ для индикатора скачивания — global_sequence пакета (как в таблице).
function packageKey(row: IDocumentPackageAggregate): string {
  return String(row?.statement?.action?.global_sequence ?? getDocumentHash(row));
}

const downloadPackage = async (
  packageAggregate: IDocumentPackageAggregate,
): Promise<void> => {
  const key = packageKey(packageAggregate);
  try {
    downloadingPackages.set(key, true);
    const { blob, archiveName } = await prepareDocumentPackageArchive(packageAggregate);
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${archiveName}.zip`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  } catch (error) {
    console.error('Ошибка при скачивании пакета документов:', error);
    FailAlert('Не удалось подготовить архив пакета документов');
  } finally {
    downloadingPackages.delete(key);
  }
};
</script>

<style lang="scss" scoped>
.document-cards {
  width: 100%;
}

.document-cards__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.document-cards__skel {
  display: block;
  width: 100%;
  height: 60px;
  border-radius: var(--p-r-md, 12px);
}

.document-cards__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  margin-top: var(--p-4, 16px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
}
</style>
