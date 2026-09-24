<template lang="pug">
div
  BaseTable(
    v-if="loading || requests.length"
    :columns="columns"
    :rows="requests"
    row-key="id"
    :loading="firstLoad"
    min-width="760px"
  )
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(#cell-member_username="{ row }")
      IdentityCell(:account-name="row.member_username" :full-name="row.display_name")
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-meta.t-muted(v-if="row.decline_reason") {{ row.decline_reason }}
    template(#cell-actions="{ row }")
      .row.no-wrap.justify-end.q-gutter-xs(v-if="isPending(row)")
        BaseButton(variant="primary" size="sm" :loading="busyId === row.id" @click="onApprove(row)") {{ $t('edubridge.returnRequestsPanel.approve') }}
        BaseButton(variant="ghost" size="sm" :disabled="busyId === row.id" @click="openDecline(row)") {{ $t('edubridge.returnRequestsPanel.decline') }}

  EmptyState(
    v-if="!firstLoad && !requests.length"
    :title="$t('edubridge.returnRequestsPanel.emptyTitle')"
    :body="$t('edubridge.returnRequestsPanel.emptyBody')"
  )
    template(#icon)
      q-icon(name="undo" size="32px")

  BaseDialog(v-model="declineOpen" :title="$t('edubridge.returnRequestsPanel.declineDialogTitle')" size="sm")
    BaseForm(:loading="declineBusy" @submit="onDecline")
      BaseInput(v-model="declineReason" :label="$t('edubridge.returnRequestsPanel.declineReasonLabel')" type="textarea" :rows="2" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="declineBusy" @click="declineOpen = false") {{ $t('edubridge.returnRequestsPanel.cancel') }}
          BaseButton(variant="danger" type="submit" :loading="declineBusy") {{ $t('edubridge.returnRequestsPanel.decline') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { IdentityCell } from 'src/shared/ui/domain';
import { approveReturn, declineReturn, fetchReturnRequests } from '../api';
import { RETURN_STATUS_LABELS, type IReturnRequest } from '../model';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../../shared/lib/live';
import { t } from '../../../i18n';

/**
 * Согласование заявлений о прекращении участия в программе: Положение ЦПП
 * требует решения кооператива. После согласования подписки пайщика
 * закрываются с возвратом по Положению, весь остаток кошелька программы
 * переходит в паевой взнос, соглашение о программе аннулируется.
 */
const emit = defineEmits<{ (e: 'decided'): void }>();

const requests = ref<IReturnRequest[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busyId = ref<string | null>(null);
const declineOpen = ref(false);
const declineBusy = ref(false);
const declineReason = ref('');
const declineTarget = ref<IReturnRequest | null>(null);
const { confirm } = useConfirm();

const columns: BaseTableColumn<IReturnRequest>[] = [
  { key: 'created_at', label: t('edubridge.returnRequestsPanel.columns.submitted'), width: '120px', nowrap: true },
  { key: 'member_username', label: t('edubridge.returnRequestsPanel.columns.member') },
  { key: 'amount', label: t('edubridge.returnRequestsPanel.columns.amount'), numeric: true, width: '150px', nowrap: true },
  { key: 'status', label: t('edubridge.returnRequestsPanel.columns.status'), width: '220px' },
  { key: 'actions', label: '', align: 'right', width: '230px' },
];

const statusOf = (s: string) => RETURN_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const isPending = (row: IReturnRequest) => row.status === Zeus.EduReturnStatus.PENDING;
const formatDate = (v: unknown) => new Date(String(v)).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  loading.value = true;
  try {
    requests.value = await fetchReturnRequests();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function replace(updated: IReturnRequest): void {
  requests.value = requests.value.map((r) => (r.id === updated.id ? updated : r));
  emit('decided');
}

async function onApprove(row: IReturnRequest): Promise<void> {
  const ok = await confirm({
    title: t('edubridge.returnRequestsPanel.approveConfirmTitle'),
    message: t('edubridge.returnRequestsPanel.approveConfirmMessage', { amount: formatAsset2Digits(row.amount) }),
    confirmLabel: t('edubridge.returnRequestsPanel.approve'),
  });
  if (!ok) return;
  busyId.value = asText(row.id);
  try {
    replace(await approveReturn(asText(row.id)));
    SuccessAlert(t('edubridge.returnRequestsPanel.approveSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busyId.value = null;
  }
}

function openDecline(row: IReturnRequest): void {
  declineTarget.value = row;
  declineReason.value = '';
  declineOpen.value = true;
}

async function onDecline(): Promise<void> {
  if (!declineTarget.value) return;
  declineBusy.value = true;
  try {
    replace(await declineReturn({ id: asText(declineTarget.value.id), reason: declineReason.value.trim() }));
    declineOpen.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    declineBusy.value = false;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.returnRequests], load);

onMounted(load);
</script>
