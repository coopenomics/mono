<template lang="pug">
.documents-table
  //- Опциональный тулбар над таблицей (фильтр типа документов и т.п.)
  .table-toolbar(v-if='$slots.top')
    slot(name='top')

  TableSkeleton(
    v-if='loading && !documents.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width='880px'
  )
  .table-wrap(v-else-if='documents.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-toggle
            th.col-id ID
            th.col-sort.col-date(@click='toggleSort') Дата {{ sortMark }}
            th Документ
            th.col-signers Подписи
            th.col-action Действия
        tbody
          template(v-for='row in sortedDocuments', :key='rowId(row)')
            tr.data-row(@click='toggleExpand(rowId(row))')
              td.col-toggle
                button.icon-btn(
                  type='button',
                  :aria-label='expanded.get(rowId(row)) ? "Свернуть" : "Развернуть"',
                  @click.stop='toggleExpand(rowId(row))'
                )
                  q-icon(:name='expanded.get(rowId(row)) ? "expand_more" : "chevron_right"')
              td.col-id(@click.stop)
                EntityIdBadge(
                  :raw-id='shortHash(row)',
                  :copy-value='getDocumentHash(row)',
                  copy-on-click
                )
              td.col-date {{ getDocumentDate(row) }}
              td
                .doc-primary {{ getDocumentTitle(row) }}
              td.col-signers
                .signers(v-if='getSigners(row).length')
                  BaseBadge(
                    v-for='(name, i) in getSigners(row)',
                    :key='i',
                    variant='neutral'
                  ) {{ name }}
                span.no-signers(v-else) —
              td.col-action(@click.stop)
                button.icon-btn(
                  type='button',
                  aria-label='Скачать пакет',
                  :disabled='downloadingPackages.get(rowId(row))',
                  @click='downloadPackage(row)'
                )
                  q-icon(name='download')

            tr.expand-row(v-if='expanded.get(rowId(row))')
              td(colspan='6')
                ComplexDocument(:documents='row')

    .table-foot
      span {{ rangeLabel }}
      BaseButton(
        v-if='hasMore',
        variant='ghost',
        size='sm',
        :loading='loading',
        @click='$emit("load")'
      ) Загрузить ещё

  EmptyState(
    v-else,
    title='Документы не найдены',
    body='Здесь появятся ваши документы и подписанные соглашения.'
  )
    template(#icon)
      q-icon(name='description', size='48px')
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { EntityIdBadge } from 'src/shared/ui/EntityIdBadge';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import { FailAlert } from 'src/shared/api';
import {
  prepareDocumentPackageArchive,
  getSignersListFromDocumentPackage,
} from 'src/shared/lib/document';
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

const emit = defineEmits<{
  (e: 'load'): void;
  (e: 'toggle-expand', id: string): void;
}>();

// Колонки скелетона повторяют шапку реальной таблицы — каркас не дёргается,
// когда подгружаются документы.
const skeletonColumns: TableSkeletonColumn[] = [
  { class: 'col-toggle', cell: 'icon' },
  { label: 'ID', class: 'col-id', cell: 'badge' },
  { label: 'Дата', class: 'col-date', cell: 'text', cellWidth: '84px' },
  { label: 'Документ', cell: 'text' },
  { label: 'Подписи', class: 'col-signers', cell: 'badge' },
  { label: 'Действия', class: 'col-action', cell: 'icon' },
];

const expanded = reactive(new Map<string, boolean>());
const downloadingPackages = reactive(new Map<string, boolean>());

// Идентификатор строки: global_sequence заявления (стабилен в рамках пакета).
function rowId(row: IDocumentPackageAggregate): string {
  return String(
    (row as any)?.id ?? row?.statement?.action?.global_sequence ?? '',
  );
}

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

function getDocumentHash(row: IDocumentPackageAggregate): string {
  return (
    row.statement?.documentAggregate?.rawDocument?.hash ||
    row.decision?.documentAggregate?.rawDocument?.hash ||
    ''
  );
}

function shortHash(row: IDocumentPackageAggregate): string {
  const h = getDocumentHash(row);
  return h ? h.substring(0, 10) : '—';
}

function getSigners(row: IDocumentPackageAggregate): string[] {
  return getSignersListFromDocumentPackage(row);
}

// Сортировка по дате (block_num); по умолчанию — свежие сверху.
const sortDir = ref<'asc' | 'desc'>('desc');
const sortMark = computed(() => (sortDir.value === 'asc' ? '↑' : '↓'));
const toggleSort = (): void => {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
};
const sortedDocuments = computed(() => {
  const list = [...props.documents];
  list.sort((a, b) => {
    const diff = getBlockNum(a) - getBlockNum(b);
    return sortDir.value === 'asc' ? diff : -diff;
  });
  return list;
});

const hasMore = computed(
  () => (props.pagination?.currentPage ?? 1) < (props.pagination?.totalPages ?? 1),
);

const rangeLabel = computed(() => {
  const total = props.pagination?.totalCount ?? props.documents.length;
  const shown = props.documents.length;
  return shown ? `1–${shown} из ${total}` : `0 из ${total}`;
});

const toggleExpand = (id: string): void => {
  if (!id) return;
  expanded.set(id, !expanded.get(id));
  emit('toggle-expand', id);
};

const downloadPackage = async (
  packageAggregate: IDocumentPackageAggregate,
): Promise<void> => {
  const packageId = packageAggregate?.statement?.action?.global_sequence;
  if (!packageId) return;
  try {
    downloadingPackages.set(String(packageId), true);
    const { blob, archiveName } = await prepareDocumentPackageArchive(
      packageAggregate,
    );
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
    downloadingPackages.delete(String(packageId));
  }
};
</script>

<style lang="scss" scoped>
.documents-table {
  width: 100%;
}

.table-toolbar {
  margin-bottom: var(--p-3, 12px);
}

/* Горизонтальный скролл на узких экранах вместо мобильной карточной верстки. */
.table-scroll {
  overflow-x: auto;
}

.table {
  table-layout: fixed;
  min-width: 780px;
}

.col-toggle {
  width: 44px;
  text-align: center;
}
.col-id {
  width: 124px;
}
.col-date {
  width: 156px;
  white-space: nowrap;
}
.col-signers {
  width: 150px;
}
.col-action {
  width: 56px;
  text-align: center;
}

.col-sort {
  cursor: pointer;
  user-select: none;
}

.doc-primary {
  overflow-wrap: anywhere;
}

.signers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.no-signers {
  color: var(--p-ink-3);
}

.data-row {
  cursor: pointer;
}

.expand-row td {
  padding: 0 20px 16px;
  background: var(--p-surface-2);
}
</style>
