<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-queue:banner-dismissed")
    | Очередь выдачи и отзыва доступа на площадках. Задачи повторяются сами; «требует вмешательства» — площадка отказала
    | или курс рассогласован: разберитесь с причиной и нажмите «Повторить». Выдать доступ в обход взноса нельзя.
  PageTabs.q-mb-md(:tabs="tabs" :active-key="tab" @select="(t) => (tab = t.key)")
  BaseTable(:columns="columns" :rows="items" row-key="id" :loading="loading && !items.length" min-width="760px")
    template(#cell-kind="{ row }") {{ kindOf(row.kind) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    template(#cell-next_attempt_at="{ row }") {{ row.status === Zeus.EduAccessTaskStatus.PENDING ? formatDateTime(row.next_attempt_at) : '—' }}
    template(#cell-actions="{ row }")
      BaseButton(v-if="row.status === Zeus.EduAccessTaskStatus.NEEDS_ATTENTION || row.status === Zeus.EduAccessTaskStatus.FAILED" variant="secondary" size="sm" :loading="busy === row.id" @click="onRetry(row)") Повторить
  EmptyState(v-if="!loading && !items.length" title="Очередь пуста" body="Все задачи выполнены.")
    template(#icon)
      q-icon(name="task_alt" size="32px")
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { TASK_KIND_LABELS, TASK_STATUS_LABELS, fetchQueue, retryTask, type IAccessTask } from '../../entities/Admin';

const tabs: PageTab[] = [
  { key: 'attention', label: 'Требуют вмешательства' },
  { key: 'active', label: 'В работе' },
  { key: 'all', label: 'Все' },
];
const tab = ref('attention');
const items = ref<IAccessTask[]>([]);
const loading = ref(false);
const busy = ref<string | null>(null);

const columns: BaseTableColumn<IAccessTask>[] = [
  { key: 'kind', label: 'Задача', width: '100px' },
  { key: 'carrier', label: 'Площадка', width: '120px' },
  { key: 'status', label: 'Состояние', width: '200px' },
  { key: 'attempts', label: 'Попыток', numeric: true, width: '90px' },
  { key: 'next_attempt_at', label: 'Следующая попытка', width: '170px' },
  { key: 'last_error', label: 'Последняя ошибка' },
  { key: 'actions', label: '', align: 'right', width: '120px' },
];
const statusOf = (s: string) => TASK_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const kindOf = (k: string) => TASK_KIND_LABELS[k] ?? k;
const formatDateTime = (v: string | Date) => new Date(v).toLocaleString('ru-RU');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const statuses =
      tab.value === 'attention'
        ? [Zeus.EduAccessTaskStatus.NEEDS_ATTENTION, Zeus.EduAccessTaskStatus.FAILED]
        : tab.value === 'active'
          ? [Zeus.EduAccessTaskStatus.PENDING, Zeus.EduAccessTaskStatus.RUNNING]
          : undefined;
    items.value = await fetchQueue(statuses);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onRetry(t: IAccessTask): Promise<void> {
  busy.value = t.id;
  try {
    const updated = await retryTask(t.id);
    items.value = items.value.map((x) => (x.id === updated.id ? updated : x));
    SuccessAlert('Задача возвращена в очередь');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

watch(tab, load);
onMounted(load);
</script>
