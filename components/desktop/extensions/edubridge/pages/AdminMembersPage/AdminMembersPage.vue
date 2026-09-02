<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-members:banner-dismissed")
    | Реестр пайщиков приложения: обучающиеся, подписки и состояние выдачи. Контакты обучающихся видит только председатель.
  .row.q-col-gutter-md
    .col-12.col-lg-5
      BaseInput.q-mb-md(v-model="search" label="Поиск по учётному имени" type="search" clearable @update:model-value="debouncedLoad")
      BaseTable(:columns="columns" :rows="rows" row-key="username" :loading="loading && !rows.length" hover min-width="560px")
        template(#cell-username="{ row }")
          BaseButton(variant="ghost" size="sm" @click="open(row.username)")
            span.t-mono {{ row.username }}
        template(#cell-attention_count="{ row }")
          BaseBadge(v-if="row.attention_count" variant="warn") {{ row.attention_count }}
          span.t-muted(v-else) —
      EmptyState(v-if="!loading && !rows.length" title="Пайщиков пока нет" body="Как только кто-то добавит обучающегося, он появится здесь.")
        template(#icon)
          q-icon(name="groups" size="32px")
    .col-12.col-lg-7
      BaseCard(v-if="card" variant="default" :title="card.username")
        .text-subtitle2.q-mb-sm Обучающиеся
        q-list(separator dense)
          q-item(v-for="l in card.learners" :key="l.id")
            q-item-section
              | {{ l.display_name }}
              .t-muted.t-sm.t-mono {{ l.recipient_value ?? 'контакт скрыт' }}
        q-separator.q-my-md
        .text-subtitle2.q-mb-sm Подписки
        BaseTable(:columns="enrollmentColumns" :rows="card.enrollments" row-key="id" min-width="480px")
          template(#cell-paid_until="{ row }") {{ row.paid_until ? formatDate(row.paid_until) : '—' }}
          template(#cell-access_state="{ row }")
            BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
        q-separator.q-my-md
        .text-subtitle2.q-mb-sm Задачи выдачи
        BaseTable(:columns="taskColumns" :rows="card.tasks" row-key="id" min-width="480px")
          template(#cell-kind="{ row }") {{ kindOf(row.kind) }}
          template(#cell-status="{ row }")
            BaseBadge(:variant="taskStatusOf(row.status).variant") {{ taskStatusOf(row.status).label }}
      EmptyState(v-else title="Выберите пайщика" body="Сводная карточка появится справа.")
        template(#icon)
          q-icon(name="badge" size="32px")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { ACCESS_STATE_LABELS } from '../../entities/Learner';
import { TASK_KIND_LABELS, TASK_STATUS_LABELS, fetchMemberCard, fetchMembers, type IMemberCard, type IMemberRow } from '../../entities/Admin';

const search = ref('');
const rows = ref<IMemberRow[]>([]);
const card = ref<IMemberCard | null>(null);
const loading = ref(false);

const columns: BaseTableColumn<IMemberRow>[] = [
  { key: 'username', label: 'Пайщик' },
  { key: 'learners_count', label: 'Обучающихся', numeric: true, width: '120px' },
  { key: 'active_enrollments', label: 'Подписок', numeric: true, width: '100px' },
  { key: 'attention_count', label: 'Внимание', width: '100px' },
];
const enrollmentColumns: BaseTableColumn<IMemberCard['enrollments'][number]>[] = [
  { key: 'course_title', label: 'Курс' },
  { key: 'paid_until', label: 'Оплачено до', width: '130px' },
  { key: 'access_state', label: 'Доступ', width: '160px' },
];
const taskColumns: BaseTableColumn<IMemberCard['tasks'][number]>[] = [
  { key: 'kind', label: 'Задача', width: '100px' },
  { key: 'status', label: 'Состояние', width: '180px' },
  { key: 'last_error', label: 'Последняя ошибка' },
];
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const taskStatusOf = (s: string) => TASK_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const kindOf = (k: string) => TASK_KIND_LABELS[k] ?? k;
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await fetchMembers(search.value || undefined);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
const debouncedLoad = debounce(load, 300);

async function open(username: string): Promise<void> {
  try {
    card.value = await fetchMemberCard(username);
  } catch (e) {
    FailAlert(e);
  }
}

onMounted(load);
</script>
