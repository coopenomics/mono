<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-settlement:banner-dismissed")
    | {{ $t('edubridge.teacherSettlementPage.hintAccrual') }}
    | {{ $t('edubridge.teacherSettlementPage.hintReturn') }}
  .row.q-col-gutter-md
    .col-12.col-md-6
      BaseCard(variant="default" :title="$t('edubridge.teacherSettlementPage.title')")
        CardListSkeleton(v-if="!settlement" :count="1")
        template(v-else)
          DataRow(:label="$t('edubridge.teacherSettlementPage.acceptedTotalLabel')" :value="formatAsset2Digits(settlement.accepted_total)")
          DataRow(:label="$t('edubridge.teacherSettlementPage.programShareLabel')" :value="formatAsset2Digits(settlement.program_share)")
          DataRow(:label="$t('edubridge.teacherSettlementPage.availableLabel')" :value="formatAsset2Digits(settlement.available)")
          DataRow(:label="$t('edubridge.teacherSettlementPage.lastAcceptedLabel')" :value="settlement.last_accepted_at ? formatDate(settlement.last_accepted_at) : '______'")
          .q-mt-md
            BaseButton(variant="secondary" @click="goToWallet") {{ $t('edubridge.teacherSettlementPage.walletReturnButton') }}
    .col-12.col-md-6(v-if="settlement && programShare > 0")
      BaseCard(variant="default" :title="$t('edubridge.teacherSettlementPage.withdrawTitle')")
        AmountInput(
          v-model="amount"
          :label="$t('edubridge.teacherSettlementPage.withdrawAmountLabel')"
          :symbol="symbol"
          :precision="2"
          :min="0"
          :max="programShare"
          :balance="programShare"
          show-max
          show-balance
          :disabled="withdrawing"
        )
        .q-mt-md
          BaseButton(variant="primary" :loading="withdrawing" :disabled="!canWithdraw" @click="onWithdraw") {{ $t('edubridge.teacherSettlementPage.withdrawButton') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asDateInput } from 'src/shared/lib/utils';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import { AmountInput, DataRow, PageHint } from 'src/shared/ui/domain';
import { fetchMySettlement, withdrawShare, type ISettlement } from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

const route = useRoute();
const router = useRouter();
const settlement = ref<ISettlement | null>(null);
const amount = ref<number | string | null>(null);
const withdrawing = ref(false);
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

/** Паевой взнос по программе приходит ассетом цепи: число и тикер раздельно. */
const programShare = computed(() => Number.parseFloat(settlement.value?.program_share ?? '0') || 0);
const symbol = computed(() => settlement.value?.program_share.split(' ')[1] ?? '');
const amountValue = computed(() => Number.parseFloat(String(amount.value ?? '').replace(',', '.')) || 0);
const canWithdraw = computed(() => amountValue.value > 0 && amountValue.value <= programShare.value);

function goToWallet(): void {
  void router.push({ name: 'wallet', params: { coopname: route.params.coopname } });
}

async function loadSettlement(): Promise<void> {
  settlement.value = await fetchMySettlement();
}

async function onWithdraw(): Promise<void> {
  if (!canWithdraw.value || withdrawing.value) return;
  withdrawing.value = true;
  try {
    settlement.value = await withdrawShare(`${amountValue.value.toFixed(4)} ${symbol.value}`);
    amount.value = null;
    SuccessAlert(t('edubridge.teacherSettlementPage.withdrawSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    withdrawing.value = false;
  }
}

// Живое обновление: взносы по урокам, переводы и выплаты меняют расчёт без перезагрузки.
useLiveReload([EduLive.contributions, EduLive.userWallets], loadSettlement);

onMounted(async () => {
  try {
    await loadSettlement();
  } catch (e) {
    FailAlert(e);
  }
});
</script>
