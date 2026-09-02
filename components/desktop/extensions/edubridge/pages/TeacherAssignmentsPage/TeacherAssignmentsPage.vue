<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-assignments:banner-dismissed")
    | Назначения — курс, расписание, ожидаемый результат и период сдачи. Назначение действует после подписи
    | приложения к договору участия в хозяйственной деятельности; сам договор подписывается один раз.

  BaseBanner.q-mb-md(v-if="contract === null" variant="warn")
    template(#icon)
      q-icon(name="history_edu")
    | Договор участия в хозяйственной деятельности ещё не подписан — без него назначения не активируются.
    | Договор подписывают двое: вы, затем председатель совета от лица кооператива.
    .q-mt-sm
      BaseButton(variant="primary" size="sm" :loading="busy === 'contract'" @click="onSignContract") Подписать договор
  BaseBanner.q-mb-md(v-else-if="contract && contract.status === Zeus.EduContractStatus.PENDING_APPROVAL" variant="info")
    template(#icon)
      q-icon(name="hourglass_top")
    | Договор № {{ contract.contract_number }} подписан вами {{ formatDate(contract.signed_at) }} и ждёт подписи председателя совета.
    | Приложения на курсы станут доступны после его подписи.
  BaseBanner.q-mb-md(v-else-if="contract && contract.status === Zeus.EduContractStatus.DECLINED" variant="neg")
    template(#icon)
      q-icon(name="block")
    | Председатель отказал в подписи договора{{ contract.decline_reason ? `: ${contract.decline_reason}` : '' }}. Договор можно подписать заново.
    .q-mt-sm
      BaseButton(variant="primary" size="sm" :loading="busy === 'contract'" @click="onSignContract") Подписать договор заново
  BaseBanner.q-mb-md(v-else-if="contract" variant="pos")
    template(#icon)
      q-icon(name="verified")
    | Договор № {{ contract.contract_number }} подписан вами {{ formatDate(contract.signed_at) }}{{ contract.approved_at ? ` и председателем ${formatDate(contract.approved_at)}` : '' }}.

  BaseTable(:columns="columns" :rows="assignments" row-key="id" :loading="loading && !assignments.length" min-width="720px")
    template(#cell-period="{ row }") {{ row.period_from }} — {{ row.period_to }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-muted.t-sm(v-if="row.decline_reason") {{ row.decline_reason }}
    template(#cell-actions="{ row }")
      BaseButton(v-if="canSignAnnex(row)" variant="primary" size="sm" :loading="busy === row.id" @click="onSignAnnex(row)") {{ row.status === Zeus.EduAssignmentStatus.DECLINED ? 'Подписать заново' : 'Подписать приложение' }}
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
// Приложение подписывается только при действующем договоре — и заново после отказа председателя.
const contractActive = () => contract.value?.status === Zeus.EduContractStatus.ACTIVE;
const canSignAnnex = (a: IAssignment) =>
  contractActive() && (a.status === Zeus.EduAssignmentStatus.DRAFT || a.status === Zeus.EduAssignmentStatus.DECLINED);
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
    SuccessAlert('Договор подписан — ждёт подписи председателя совета');
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
    SuccessAlert('Приложение подписано — ждёт подписи председателя совета');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

onMounted(load);
</script>
