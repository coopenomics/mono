<template lang="pug">
BaseCard(variant="default" :title="$t('edubridge.returnToShareCard.title')")
  DataRow(:label="$t('edubridge.returnToShareCard.balanceLabel')" :value="formatAsset2Digits(balance?.available ?? '')" align="spread")
  .t-sm.t-muted.q-mt-sm
    | {{ $t('edubridge.returnToShareCard.balanceHint') }}
  .row.justify-end.q-mt-md
    BaseButton(variant="secondary" size="sm" :disabled="!canRequest" @click="dialogOpen = true") {{ $t('edubridge.returnToShareCard.stopParticipation') }}
  .t-meta.t-muted.q-mt-sm(v-if="balance?.has_pending") {{ $t('edubridge.returnToShareCard.pendingNotice') }}

  BaseTable.q-mt-md(v-if="requests.length" :columns="columns" :rows="requests" row-key="id" min-width="480px")
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-meta.t-muted(v-if="row.decline_reason") {{ row.decline_reason }}

  BaseDialog(v-model="dialogOpen" :title="$t('edubridge.returnToShareCard.stopParticipation')" size="sm")
    BaseForm(:loading="busy" @submit="onSubmit")
      DataRow(:label="$t('edubridge.returnToShareCard.programBalanceLabel')" :value="formatAsset2Digits(balance?.available ?? '')" align="spread")
      DataRow(
        v-if="(balance?.subscriptions ?? 0) > 0"
        :label="$t(`edubridge.returnToShareCard.subscriptionRefundsLabel`, { count: balance?.subscriptions })"
        :value="formatAsset2Digits(balance?.refunds ?? '')"
        align="spread"
      )
      DataRow(:label="$t('edubridge.returnToShareCard.shareEstimateLabel')" :value="formatAsset2Digits(balance?.total ?? '')" align="spread")
      .t-sm.t-muted.q-mt-sm
        | {{ $t('edubridge.returnToShareCard.dialogIntro') }}
        | {{ $t('edubridge.returnToShareCard.exactAmountHint') }}
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="dialogOpen = false") {{ $t('edubridge.returnToShareCard.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.returnToShareCard.signStatement') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { buildProgramAnnulment, fetchMyReturnRequests, fetchReturnBalance, requestReturn } from '../api';
import { RETURN_STATUS_LABELS, type IReturnBalance, type IReturnRequest } from '../model';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../../shared/lib/live';
import { t } from '../../../i18n';

/**
 * Остаток кошелька программы и прекращение участия в программе. Членский взнос
 * программы возвращается в паевой только с прекращением участия, по заявлению
 * и согласованию кооператива, — поэтому кнопка подаёт заявление, а не переводит средства.
 */
const balance = ref<IReturnBalance | null>(null);
const requests = ref<IReturnRequest[]>([]);
const dialogOpen = ref(false);
const busy = ref(false);

const columns: BaseTableColumn<IReturnRequest>[] = [
  { key: 'created_at', label: t('edubridge.returnToShareCard.columns.submitted'), width: '120px', nowrap: true },
  { key: 'amount', label: t('edubridge.returnToShareCard.columns.amount'), numeric: true, width: '140px', nowrap: true },
  { key: 'status', label: t('edubridge.returnToShareCard.columns.status') },
];

const canRequest = computed(() => Boolean(balance.value) && !balance.value?.has_pending);

const statusOf = (s: string) => RETURN_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => new Date(String(v)).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  try {
    const [b, r] = await Promise.all([fetchReturnBalance(), fetchMyReturnRequests()]);
    balance.value = b;
    requests.value = r;
  } catch (e) {
    FailAlert(e);
  }
}

async function onSubmit(): Promise<void> {
  busy.value = true;
  try {
    const document = await buildProgramAnnulment();
    const created = await requestReturn(document);
    requests.value = [created, ...requests.value];
    balance.value = await fetchReturnBalance();
    dialogOpen.value = false;
    SuccessAlert(t('edubridge.returnToShareCard.submitSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.returnRequests, EduLive.userWallets], load);

onMounted(load);
</script>
