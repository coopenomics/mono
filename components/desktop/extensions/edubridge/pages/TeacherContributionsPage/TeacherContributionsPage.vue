<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-contributions:banner-dismissed")
    | Взнос появляется здесь после отчёта о занятии: сумма равна часам занятия по вашей ставке. Передайте
    | материалы кооперативу — он примет их на ответственное хранение на срок гарантии курса, а подписанное
    | вместе с актом заявление уйдёт в совет по окончании срока. После решения совета подпишите акт
    | приёма-передачи: сумма поступит в ваш кошелёк правом требования.

  BaseTable(v-if="loading || items.length" :columns="columns" :rows="items" row-key="id" :loading="firstLoad" min-width="900px")
    template(#cell-rid_type="{ row }") {{ ridType(row.rid_type) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-muted.t-sm(v-if="row.status === Zeus.EduContributionStatus.HELD && row.hold_until") на хранении до {{ formatDate(row.hold_until) }}
      .t-muted.t-sm(v-if="row.decline_reason") {{ row.decline_reason }}
    template(#cell-actions="{ row }")
      BaseButton(v-if="row.status === Zeus.EduContributionStatus.DRAFT" variant="primary" size="sm" :loading="busy === row.id" @click="onSubmit(row)") Передать материалы
      BaseButton(v-else-if="row.status === Zeus.EduContributionStatus.COUNCIL_APPROVED" variant="primary" size="sm" :loading="busy === row.id" @click="onSignAct(row)") Подписать акт
  EmptyState(v-if="!firstLoad && !items.length" title="Взносов пока нет" body="Отчитайтесь о проведённом занятии на странице «Занятия» — взнос появится здесь.")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  fetchMyContributions,
  commitLessonMaterials,
  signAct,
  type IContribution,
} from '../../entities/Teacher';

const items = ref<IContribution[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref<string | null>(null);

const columns: BaseTableColumn<IContribution>[] = [
  { key: 'rid_type', label: 'Тип результата', width: '200px' },
  { key: 'description', label: 'Описание' },
  { key: 'amount', label: 'Сумма', numeric: true, width: '140px' },
  { key: 'status', label: 'Состояние', width: '220px' },
  { key: 'actions', label: '', align: 'right', width: '200px' },
];
const ridType = (t: string) => RID_TYPE_LABELS[t] ?? t;
const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await fetchMyContributions();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function replace(c: IContribution): void {
  const i = items.value.findIndex((x) => x.id === c.id);
  if (i >= 0) items.value[i] = c;
  else items.value.unshift(c);
}

async function onSubmit(c: IContribution): Promise<void> {
  busy.value = asText(c.id);
  try {
    replace(await commitLessonMaterials(c));
    SuccessAlert('Материалы приняты на ответственное хранение, заявление подписано');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

async function onSignAct(c: IContribution): Promise<void> {
  busy.value = asText(c.id);
  try {
    replace(await signAct(c));
    SuccessAlert('Акт подписан — ждём подпись председателя');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

onMounted(load);
</script>
