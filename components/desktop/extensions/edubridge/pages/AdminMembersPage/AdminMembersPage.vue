<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-members:banner-dismissed")
    | Реестр пайщиков приложения: обучающиеся, подписки и состояние выдачи. Контакты обучающихся видит только председатель.

  BaseInput.q-mb-md(v-model="search" label="Поиск по ФИО или учётному имени" type="search" clearable @update:model-value="debouncedLoad")

  BaseTable(v-if="loading || rows.length" :columns="columns" :rows="rows" row-key="username" :loading="loading && !rows.length" hover min-width="720px")
    template(#cell-member="{ row }")
      .text-weight-medium {{ row.display_name || row.username }}
      .t-muted.t-sm.t-mono {{ row.username }}
    template(#cell-attention_count="{ row }")
      BaseBadge(v-if="row.attention_count" variant="warn") {{ row.attention_count }}
      span.t-muted(v-else) ______
    template(#cell-actions="{ row }")
      BaseButton(variant="secondary" size="sm" :loading="opening === row.username" @click="open(row)") Открыть
  EmptyState(v-if="!loading && !rows.length" :title="search ? 'Никого не нашлось' : 'Пайщиков пока нет'" :body="search ? 'Попробуйте другую фамилию или учётное имя.' : 'Как только кто-то добавит обучающегося, он появится здесь.'")
    template(#icon)
      q-icon(name="groups" size="32px")

  DetailsDrawer(v-model="drawerOpen" :title="card ? (card.display_name || card.username) : ''" :width="720")
    template(v-if="card")
      DataRow(label="Учётное имя" :value="card.username" mono copyable)
      .text-subtitle2.q-mt-md.q-mb-sm Обучающиеся
      EmptyState(v-if="!card.learners.length" title="Обучающихся нет")
      q-list(v-else separator dense)
        q-item(v-for="l in card.learners" :key="l.id")
          q-item-section
            | {{ l.display_name }}
            .t-muted.t-sm.t-mono {{ l.recipient_value ?? 'контакт скрыт' }}
      .text-subtitle2.q-mt-md.q-mb-sm Подписки
      BaseTable(v-if="card.enrollments.length" :columns="enrollmentColumns" :rows="card.enrollments" row-key="id" min-width="480px")
        template(#cell-paid_until="{ row }") {{ row.paid_until ? formatDate(row.paid_until) : '______' }}
        template(#cell-access_state="{ row }")
          BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
      EmptyState(v-else title="Подписок нет")
      .text-subtitle2.q-mt-md.q-mb-sm Задачи выдачи
      BaseTable(v-if="card.tasks.length" :columns="taskColumns" :rows="card.tasks" row-key="id" min-width="480px")
        template(#cell-kind="{ row }") {{ kindOf(row.kind) }}
        template(#cell-status="{ row }")
          BaseBadge(:variant="taskStatusOf(row.status).variant") {{ taskStatusOf(row.status).label }}
      EmptyState(v-else title="Задач выдачи нет")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { ACCESS_STATE_LABELS } from '../../entities/Learner';
import { TASK_KIND_LABELS, TASK_STATUS_LABELS, fetchMemberCard, fetchMembers, type IMemberCard, type IMemberRow } from '../../entities/Admin';

/**
 * Реестр пайщиков приложения: строка — ФИО и учётное имя, счётчики; сводная
 * карточка открывается боковой панелью. Поиск — по ФИО и учётному имени,
 * ФИО отдаёт бэкенд из сертификата пайщика.
 */
const search = ref('');
const rows = ref<IMemberRow[]>([]);
const card = ref<IMemberCard | null>(null);
const loading = ref(false);
const opening = ref<string | null>(null);
const drawerOpen = ref(false);

const columns: BaseTableColumn<IMemberRow>[] = [
  { key: 'member', label: 'Пайщик' },
  { key: 'learners_count', label: 'Обучающихся', numeric: true, width: '130px' },
  { key: 'active_enrollments', label: 'Подписок', numeric: true, width: '110px' },
  { key: 'attention_count', label: 'Внимание', width: '110px' },
  { key: 'actions', label: '', align: 'right', width: '120px' },
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

async function open(row: IMemberRow): Promise<void> {
  opening.value = row.username;
  try {
    card.value = await fetchMemberCard(row.username);
    drawerOpen.value = true;
  } catch (e) {
    FailAlert(e);
  } finally {
    opening.value = null;
  }
}

onMounted(load);
</script>
