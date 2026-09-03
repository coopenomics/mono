<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-members:banner-dismissed")
    | Реестр пайщиков приложения: обучающиеся, подписки и состояние выдачи. Контакты обучающихся видит только председатель.

  BaseInput.q-mb-md(v-model="search" label="Поиск по ФИО или учётному имени" type="search" clearable @update:model-value="debouncedLoad")

  BaseTable(v-if="loading || rows.length" :columns="columns" :rows="rows" row-key="username" :loading="loading && !rows.length" hover min-width="760px")
    template(#cell-member="{ row }")
      IdentityCell(:account-name="row.username" :full-name="row.display_name || null")
    template(#cell-access="{ row }")
      BaseBadge(v-if="row.attention_count" variant="warn") застряло: {{ row.attention_count }}
      BaseBadge(v-else-if="row.active_enrollments" variant="pos") выдан
      BaseBadge(v-else variant="neutral") нет подписок
    template(#cell-actions="{ row }")
      BaseButton(variant="secondary" size="sm" :loading="opening === row.username" @click="open(row)") Открыть
  EmptyState(v-if="!loading && !rows.length" :title="search ? 'Никого не нашлось' : 'Пайщиков пока нет'" :body="search ? 'Попробуйте другую фамилию или учётное имя.' : 'Как только кто-то добавит обучающегося, он появится здесь.'")
    template(#icon)
      q-icon(name="groups" size="32px")

  DetailsDrawer(v-model="drawerOpen" :title="card ? (card.display_name || card.username) : ''" :width="720")
    template(v-if="card")
      .edu-member__section
        .edu-member__head
          .text-subtitle2 Пайщик
        DataRow(label="Учётное имя" :value="card.username" mono copyable)
        DataRow(label="Обучающихся" :value="card.learners.length")
        DataRow(label="Подписок" :value="card.enrollments.length")

      .edu-member__section
        .edu-member__head
          .text-subtitle2 Обучающиеся
        .t-sm.t-muted(v-if="!card.learners.length") Обучающихся нет.
        DataRow(v-for="l in card.learners" :key="l.id" :label="l.display_name" :value="l.recipient_value ?? 'контакт скрыт'" mono)

      .edu-member__section
        .edu-member__head
          .text-subtitle2 Подписки
        .t-sm.t-muted(v-if="!card.enrollments.length") Подписок нет.
        BaseTable(v-else :columns="enrollmentColumns" :rows="card.enrollments" row-key="id" min-width="480px")
          template(#cell-paid_until="{ row }") {{ row.paid_until ? formatDate(row.paid_until) : '______' }}
          template(#cell-access_state="{ row }")
            BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}

      .edu-member__section
        .edu-member__head
          .text-subtitle2 Задачи выдачи
        .t-sm.t-muted(v-if="!card.tasks.length") Задач выдачи нет.
        BaseTable(v-else :columns="taskColumns" :rows="card.tasks" row-key="id" min-width="480px")
          template(#cell-kind="{ row }") {{ kindOf(row.kind) }}
          template(#cell-status="{ row }")
            BaseBadge(:variant="taskStatusOf(row.status).variant") {{ taskStatusOf(row.status).label }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { ACCESS_STATE_LABELS } from '../../entities/Learner';
import { TASK_KIND_LABELS, TASK_STATUS_LABELS, fetchMemberCard, fetchMembers, type IMemberCard, type IMemberRow } from '../../entities/Admin';

/**
 * Реестр пайщиков приложения: строка — ФИО и учётное имя (IdentityCell, как во
 * всех реестрах), счётчики и состояние выдачи; сводная карточка открывается
 * боковой панелью. Поиск — по ФИО и учётному имени, ФИО отдаёт бэкенд из
 * сертификата пайщика.
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
  { key: 'access', label: 'Выдача доступа', width: '160px' },
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

<style scoped>
.edu-member__section + .edu-member__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-member__head {
  margin-bottom: var(--p-2);
}
</style>
