<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-contributions:banner-dismissed")
    | Взносы результатами работы: преподаватель подаёт результат по действующему назначению, решение принимает
    | совет в повестке. Здесь председатель подписывает акт приёма-передачи — после этого взнос попадает
    | в паевой фонд — либо отклоняет взнос с причиной.

  BaseTable(v-if="loading || contributions.length" :columns="columns" :rows="contributions" row-key="id" :loading="firstLoad" min-width="920px")
    template(#cell-teacher_username="{ row }")
      IdentityCell(:account-name="row.teacher_username" :full-name="teacherName(row.teacher_username)")
    template(#cell-rid_type="{ row }") {{ ridType(row.rid_type) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    template(#cell-actions="{ row }")
      .row.no-wrap.justify-end.q-gutter-xs
        BaseButton(v-if="row.status === Zeus.EduContributionStatus.ACT_SIGNED" variant="primary" size="sm" :loading="busyId === row.id" @click="onAccept(row)") Подписать акт
        BaseButton(v-if="canDecline(row)" variant="ghost" size="sm" @click="openDecline(row)") Отклонить

  EmptyState(v-if="!firstLoad && !contributions.length" title="Взносов нет" body="Взнос появляется, когда преподаватель подаёт результат работы по действующему назначению.")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

  BaseDialog(v-model="declineOpen" title="Отклонить взнос" size="sm")
    BaseForm(:loading="busy" @submit="onDecline")
      BaseInput(v-model="declineReason" label="Причина" type="textarea" :rows="3" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="declineOpen = false") Отменить
          BaseButton(variant="danger" type="submit" :loading="busy") Отклонить
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { IdentityCell, PageHint } from 'src/shared/ui/domain';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  acceptContributionAsChairman,
  declineContribution,
  fetchContributions,
  fetchTeachers,
  type IContribution,
  type ITeacher,
} from '../../entities/Teacher';

/**
 * Взносы результатами работы — отдельной страницей: председатель разбирает их
 * сам по себе, а не попутно с назначениями. Решение по взносу принимает совет
 * в повестке; здесь ставится вторая подпись на акте приёма-передачи и
 * оформляется отказ с причиной.
 */
const contributions = ref<IContribution[]>([]);
const teachers = ref<ITeacher[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const busyId = ref<string | null>(null);
const declineOpen = ref(false);
const declineTarget = ref<IContribution | null>(null);
const declineReason = ref('');

const columns: BaseTableColumn<IContribution>[] = [
  { key: 'teacher_username', label: 'Преподаватель', width: '240px' },
  { key: 'rid_type', label: 'Тип', width: '160px' },
  { key: 'description', label: 'Описание' },
  { key: 'amount', label: 'Сумма', numeric: true, width: '130px', nowrap: true },
  { key: 'status', label: 'Состояние', width: '190px' },
  { key: 'actions', label: '', align: 'right', width: '200px' },
];

const DECLINABLE = new Set<string>([Zeus.EduContributionStatus.SUBMITTED, Zeus.EduContributionStatus.COUNCIL_APPROVED, Zeus.EduContributionStatus.ACT_SIGNED]);
const canDecline = (c: IContribution) => DECLINABLE.has(c.status);
const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const ridType = (t: string) => RID_TYPE_LABELS[t] ?? t;
// ФИО известны по договору преподавателя; без него остаётся учётное имя.
const teacherName = (username: string) => teachers.value.find((t) => t.username === username)?.display_name || null;

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [c, t] = await Promise.all([fetchContributions(), fetchTeachers()]);
    contributions.value = c;
    teachers.value = t;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onAccept(c: IContribution): Promise<void> {
  busyId.value = asText(c.id);
  try {
    const updated = await acceptContributionAsChairman(c);
    contributions.value = contributions.value.map((x) => (x.id === updated.id ? updated : x));
    SuccessAlert('Акт подписан — взнос принят в паевой фонд');
  } catch (e) {
    FailAlert(e);
  } finally {
    busyId.value = null;
  }
}

function openDecline(c: IContribution): void {
  declineTarget.value = c;
  declineReason.value = '';
  declineOpen.value = true;
}

async function onDecline(): Promise<void> {
  if (!declineTarget.value) return;
  busy.value = true;
  try {
    const updated = await declineContribution(asText(declineTarget.value.id), declineReason.value.trim());
    contributions.value = contributions.value.map((x) => (x.id === updated.id ? updated : x));
    declineOpen.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
