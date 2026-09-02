<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-contributions:banner-dismissed")
    | Паевой взнос результатами работы: укажите тип результата, ссылки на материалы и сумму, подпишите заявление —
    | совет рассмотрит его. После решения совета подпишите акт приёма-передачи: сумма поступит в ваш кошелёк правом требования.

  BaseTable(:columns="columns" :rows="items" row-key="id" :loading="loading && !items.length" min-width="760px")
    template(#cell-rid_type="{ row }") {{ ridType(row.rid_type) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-muted.t-sm(v-if="row.decline_reason") {{ row.decline_reason }}
    template(#cell-actions="{ row }")
      BaseButton(v-if="row.status === Zeus.EduContributionStatus.DRAFT" variant="primary" size="sm" :loading="busy === row.id" @click="onSubmit(row)") Подписать заявление
      BaseButton(v-else-if="row.status === Zeus.EduContributionStatus.COUNCIL_APPROVED" variant="primary" size="sm" :loading="busy === row.id" @click="onSignAct(row)") Подписать акт
  EmptyState(v-if="!loading && !items.length" title="Взносов пока нет" body="Подготовьте взнос кнопкой в правом верхнем углу.")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

  BaseDialog(v-model="dialogOpen" title="Новый взнос результатами работы" size="md")
    BaseForm(:loading="busy === 'draft'" @submit="onDraft")
      BaseSelect(v-model="form.assignment_id" label="Назначение" :options="assignmentOptions" required)
      BaseSelect(v-model="form.rid_type" label="Тип результата" :options="ridTypeOptions" required)
      BaseInput(v-model="linksText" label="Ссылки на материалы" type="textarea" :rows="3" hint="По одной ссылке на строку" required)
      BaseInput(v-model="form.description" label="Описание" type="textarea" :rows="2")
      BaseInput(v-model="amountNumber" label="Сумма паевого взноса" type="number" :suffix="symbol" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="dialogOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="busy === 'draft'") Подготовить
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { useSystemStore } from 'src/entities/System/model';
import { formatToAsset } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  draftContribution,
  fetchMyAssignments,
  fetchMyContributions,
  signAct,
  submitContribution,
  type IAssignment,
  type IContribution,
  type IContributionDraftInput,
} from '../../entities/Teacher';
import NewContributionHeaderButton from './NewContributionHeaderButton.vue';

const { registerAction } = useHeaderActions();
const system = useSystemStore();
const symbol = computed(() => system.governSymbol);

const items = ref<IContribution[]>([]);
const assignments = ref<IAssignment[]>([]);
const loading = ref(false);
const busy = ref<string | null>(null);
const dialogOpen = ref(false);
const form = reactive<IContributionDraftInput>({ assignment_id: '', rid_type: Zeus.EduRidType.LESSON_RECORDING, links: [], description: '', amount: '' });
const linksText = ref('');
const amountNumber = ref('');

const columns: BaseTableColumn<IContribution>[] = [
  { key: 'rid_type', label: 'Тип результата', width: '200px' },
  { key: 'description', label: 'Описание' },
  { key: 'amount', label: 'Сумма', numeric: true, width: '140px' },
  { key: 'status', label: 'Состояние', width: '220px' },
  { key: 'actions', label: '', align: 'right', width: '200px' },
];
const ridType = (t: string) => RID_TYPE_LABELS[t] ?? t;
const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const assignmentOptions = computed(() => assignments.value.filter((a) => a.status === Zeus.EduAssignmentStatus.ACTIVE).map((a) => ({ value: a.id, label: `${a.course_title} (${a.period_from} — ${a.period_to})` })));
const ridTypeOptions = Object.entries(RID_TYPE_LABELS).map(([value, label]) => ({ value, label }));

async function load(): Promise<void> {
  loading.value = true;
  try {
    [items.value, assignments.value] = await Promise.all([fetchMyContributions(), fetchMyAssignments()]);
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

async function onDraft(): Promise<void> {
  busy.value = 'draft';
  try {
    const created = await draftContribution({
      ...form,
      links: linksText.value.split('\n').map((l) => l.trim()).filter(Boolean),
      amount: formatToAsset(amountNumber.value.replace(',', '.'), symbol.value),
    });
    replace(created);
    dialogOpen.value = false;
    SuccessAlert('Черновик подготовлен — подпишите заявление');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

async function onSubmit(c: IContribution): Promise<void> {
  busy.value = c.id;
  try {
    replace(await submitContribution(c));
    SuccessAlert('Заявление подписано, проект решения направлен совету');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

async function onSignAct(c: IContribution): Promise<void> {
  busy.value = c.id;
  try {
    replace(await signAct(c));
    SuccessAlert('Акт подписан — ждём подпись председателя');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

onMounted(() => {
  registerAction({ id: 'edubridge:new-contribution', component: NewContributionHeaderButton, props: { onClick: () => (dialogOpen.value = true) } });
  void load();
});
</script>
