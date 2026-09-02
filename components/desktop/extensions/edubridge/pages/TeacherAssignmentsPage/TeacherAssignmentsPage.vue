<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-assignments:banner-dismissed")
    | Назначения — курс, расписание, ожидаемый результат и период сдачи. Назначение действует после подписи
    | приложения к договору участия в хозяйственной деятельности; сам договор подписывается один раз.

  BaseBanner.q-mb-md(v-if="contract === null" variant="warn")
    template(#icon)
      q-icon(name="history_edu")
    | Договор участия в хозяйственной деятельности ещё не подписан — без него назначения не активируются.
    .q-mt-sm
      BaseButton(variant="primary" size="sm" :loading="busy === 'contract'" @click="onSignContract") Подписать договор
  BaseBanner.q-mb-md(v-else-if="contract" variant="pos")
    template(#icon)
      q-icon(name="verified")
    | Договор № {{ contract.contract_number }} подписан {{ formatDate(contract.signed_at) }}.

  BaseTable(:columns="columns" :rows="assignments" row-key="id" :loading="loading && !assignments.length" min-width="720px")
    template(#cell-period="{ row }") {{ row.period_from }} — {{ row.period_to }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    template(#cell-actions="{ row }")
      BaseButton(v-if="row.status === Zeus.EduAssignmentStatus.DRAFT && contract" variant="primary" size="sm" :loading="busy === row.id" @click="onSignAnnex(row)") Подписать приложение
  EmptyState(v-if="!loading && !assignments.length" title="Назначений пока нет" body="Администратор ещё не назначил вам курс.")
    template(#icon)
      q-icon(name="assignment" size="32px")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseBanner, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { ASSIGNMENT_STATUS_LABELS, fetchMyAssignments, fetchMyContract, signAnnex, signContract, type IAssignment, type IContract } from '../../entities/Teacher';

const contract = ref<IContract | null | undefined>(undefined);
const assignments = ref<IAssignment[]>([]);
const loading = ref(false);
const busy = ref<string | null>(null);

const columns: BaseTableColumn<IAssignment>[] = [
  { key: 'course_title', label: 'Курс' },
  { key: 'schedule', label: 'Расписание', width: '180px' },
  { key: 'expected_result', label: 'Ожидаемый результат' },
  { key: 'period', label: 'Период сдачи', width: '200px' },
  { key: 'status', label: 'Состояние', width: '180px' },
  { key: 'actions', label: '', align: 'right', width: '200px' },
];
const statusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  loading.value = true;
  try {
    [contract.value, assignments.value] = await Promise.all([fetchMyContract(), fetchMyAssignments()]);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onSignContract(): Promise<void> {
  busy.value = 'contract';
  try {
    contract.value = await signContract();
    SuccessAlert('Договор подписан');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

async function onSignAnnex(a: IAssignment): Promise<void> {
  if (!contract.value) return;
  busy.value = a.id;
  try {
    const updated = await signAnnex(a, contract.value.contract_number);
    assignments.value = assignments.value.map((x) => (x.id === updated.id ? updated : x));
    SuccessAlert('Приложение подписано — назначение действует');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

onMounted(load);
</script>
