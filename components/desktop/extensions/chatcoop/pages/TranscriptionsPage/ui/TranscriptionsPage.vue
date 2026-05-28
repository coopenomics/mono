<template lang="pug">
q-page.transcriptions-page(padding)
  header.tr-head
    div.tr-head__text
      h1.tr-head__title Транскрипции звонков
      p.tr-head__subtitle Записи распознанной речи из кооперативных звонков
    q-btn.tr-head__action(
      flat
      round
      dense
      icon="fa-solid fa-rotate-right"
      @click="handleRefresh"
      :loading="transcriptionStore.isLoading"
      aria-label="Обновить список"
    )
      q-tooltip Обновить

  .text-caption.text-grey-7.q-mb-xs
    | Время указано в вашем часовом поясе.

  q-table(
    flat
    bordered
    :rows="transcriptionStore.transcriptions"
    :columns="columns"
    row-key="id"
    v-model:pagination="pagination"
    :rows-per-page-options="[25]"
    :loading="transcriptionStore.isLoading"
    no-data-label="Нет транскрипций"
    @row-click="onRowClick"
  )
    template(#body-cell-title="props")
      q-td.tr-title-cell(:props="props")
        .tr-title-cell__name {{ props.row.roomName || 'Звонок' }}
        .tr-title-cell__memo(v-if="props.row.memo") {{ memoPreview(props.row.memo) }}
    template(#body-cell-startedAt="props")
      q-td(:props="props") {{ formatDateTime(props.row.startedAt) }}
    template(#body-cell-duration="props")
      q-td(:props="props")
        | {{ props.row.endedAt ? formatDuration(props.row.startedAt, props.row.endedAt) : '—' }}
    template(#body-cell-participants="props")
      q-td(:props="props") {{ props.row.participants?.length ?? 0 }}
    template(#body-cell-status="props")
      q-td(:props="props")
        q-badge(
          :color="getStatusColor(props.row.status)"
          :label="getStatusLabel(props.row.status)"
          outline
        )

  div.tr-loadmore(v-if="hasMore")
    q-btn(flat dense no-caps color="grey-7" @click="loadMore" :loading="transcriptionStore.isLoading") Загрузить ещё
</template>

<script lang="ts" setup>
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  formatDateTime,
  formatDuration,
  getStatusColor,
  getStatusLabel,
} from '../../../shared/lib/transcriptionUtils';
import { useTranscriptionStore } from '../../../entities/Transcription/model';
import type { ITranscription } from '../../../entities/Transcription/model/types';

const router = useRouter();
const transcriptionStore = useTranscriptionStore();

const pageSize = 20;
let currentOffset = 0;

const pagination = ref({
  page: 1,
  rowsPerPage: 25,
});

const columns = [
  {
    name: 'title',
    label: 'Звонок',
    field: 'roomName',
    align: 'left' as const,
    style: 'min-width: 320px;',
  },
  { name: 'startedAt', label: 'Начало', field: 'startedAt', align: 'left' as const },
  { name: 'duration', label: 'Длительность', field: 'endedAt', align: 'left' as const },
  { name: 'participants', label: 'Участники', field: 'participants', align: 'right' as const },
  { name: 'status', label: 'Статус', field: 'status', align: 'left' as const },
];

const hasMore = computed(() => {
  return transcriptionStore.transcriptions.length >= currentOffset + pageSize;
});

function memoPreview(memo: string): string {
  const firstLine = memo.split('\n').find((line) => line.trim().length > 0) ?? '';
  return firstLine.length > 180 ? `${firstLine.slice(0, 177)}…` : firstLine;
}

function goToDetail(id: string): void {
  router.push({
    name: 'chatcoop-transcription-detail',
    params: { id },
  });
}

function onRowClick(_evt: Event, row: ITranscription): void {
  goToDetail(row.id);
}

async function handleRefresh(): Promise<void> {
  currentOffset = 0;
  await transcriptionStore.loadTranscriptions(pageSize, 0);
}

async function loadMore(): Promise<void> {
  currentOffset += pageSize;
  await transcriptionStore.loadTranscriptions(pageSize, currentOffset);
}

onMounted(async () => {
  await transcriptionStore.loadTranscriptions(pageSize, 0);
});
</script>

<style scoped>
.tr-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.tr-head__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.tr-head__subtitle {
  margin: 6px 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.55);
  max-width: 48rem;
}

.body--dark .tr-head__subtitle {
  color: rgba(255, 255, 255, 0.55);
}

.tr-head__action {
  color: rgba(0, 0, 0, 0.55);
  flex-shrink: 0;
}

.body--dark .tr-head__action {
  color: rgba(255, 255, 255, 0.55);
}

.tr-title-cell {
  max-width: 520px;
  white-space: normal;
  word-break: break-word;
}

.tr-title-cell__name {
  font-weight: 500;
  line-height: 1.35;
}

.tr-title-cell__memo {
  margin-top: 4px;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.body--dark .tr-title-cell__memo {
  color: rgba(255, 255, 255, 0.55);
}

.tr-loadmore {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

:deep(.q-table tbody tr) {
  cursor: pointer;
}
</style>
