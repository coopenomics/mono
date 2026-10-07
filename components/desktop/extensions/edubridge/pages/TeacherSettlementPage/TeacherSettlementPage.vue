<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-settlement:banner-dismissed")
    | {{ $t('edubridge.teacherSettlementPage.hintAccrual') }}
    | {{ $t('edubridge.teacherSettlementPage.hintReturn') }}

  //- Один кошелёк и два действия: перевести в Цифровой Кошелёк и получить возврат там.
  BaseCard.edu-settle__wallet(variant="default")
    WalletCard(
      neutral
      icon="school"
      :title="$t('edubridge.teacherSettlementPage.programShareLabel')"
      :subtitle="$t('edubridge.teacherSettlementPage.programShareSub')"
      :balance="share.amount"
      :symbol="share.symbol"
      :loading="!settlement"
      :empty="programShare <= 0"
    )
    .edu-settle__actions
      BaseButton(variant="primary" :disabled="!settlement || programShare <= 0" @click="openWithdraw")
        template(#icon-left)
          q-icon(name="swap_horiz" size="18px")
        | {{ $t('edubridge.teacherSettlementPage.withdrawButton') }}
      BaseButton(variant="secondary" @click="goToWallet")
        template(#icon-left)
          q-icon(name="account_balance_wallet" size="18px")
        | {{ $t('edubridge.teacherSettlementPage.walletReturnButton') }}
      .t-sm.t-muted(v-if="settlement && programShare <= 0") {{ $t('edubridge.teacherSettlementPage.nothingToWithdraw') }}

  //- Выписка: зачисления по принятым результатам и переводы в Цифровой Кошелёк — вход и выход в одном месте.
  .t-h3.q-mt-lg.q-mb-sm {{ $t('edubridge.teacherSettlementPage.historyTitle') }}
  BaseTable(
    v-if="firstLoad || movements.length"
    :columns="columns"
    :rows="movements"
    row-key="id"
    :loading="firstLoad"
    min-width="640px"
  )
    template(#cell-at="{ row }") {{ formatDateTime(row.at) }}
    template(#cell-title="{ row }")
      .edu-settle__move
        q-icon.edu-settle__dir(:name="row.direction === 'in' ? 'south_west' : 'north_east'" :class="row.direction === 'in' ? 'edu-settle__dir--in' : 'edu-settle__dir--out'" size="16px")
        span {{ row.title }}
    template(#cell-amount="{ row }")
      span.t-num(:class="row.direction === 'in' ? 't-pos' : ''") {{ row.direction === 'in' ? '+' : '−' }} {{ formatAsset2Digits(row.amount) }}
  EmptyState(v-else :title="$t('edubridge.teacherSettlementPage.historyEmptyTitle')" :body="$t('edubridge.teacherSettlementPage.historyEmptyBody')")
    template(#icon)
      q-icon(name="receipt_long" size="32px")

  //- Перевод — отдельным окном: сумма и подтверждение, карточка кошелька остаётся на месте.
  BaseDialog(v-model="withdrawOpen" :title="$t('edubridge.teacherSettlementPage.withdrawTitle')" size="sm")
    AmountInput(
      v-model="amount"
      :label="$t('edubridge.teacherSettlementPage.withdrawAmountLabel')"
      :symbol="share.symbol"
      :precision="2"
      :min="0"
      :max="programShare"
      :balance="programShare"
      show-max
      show-balance
      :disabled="withdrawing"
    )
    .t-sm.t-muted.q-mt-sm {{ $t('edubridge.teacherSettlementPage.withdrawNote') }}
    template(#footer)
      BaseButton(variant="ghost" :disabled="withdrawing" @click="withdrawOpen = false") {{ $t('common.action.cancel') }}
      BaseButton(variant="primary" :loading="withdrawing" :disabled="!canWithdraw" @click="onWithdraw") {{ $t('edubridge.teacherSettlementPage.withdrawButton') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asDateInput } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseDialog, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { AmountInput, PageHint, WalletCard } from 'src/shared/ui/domain';
import { fetchMySettlement, fetchMySettlementHistory, withdrawShare, type ISettlement, type ISettlementMovement } from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Расчёт с преподавателем: его паевой взнос по программе одним кошельком,
 * перевод в Цифровой Кошелёк и возврат оттуда, под ними выписка — что
 * зачислено по принятым результатам и что переведено.
 */
const route = useRoute();
const router = useRouter();
const settlement = ref<ISettlement | null>(null);
const movements = ref<ISettlementMovement[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const withdrawOpen = ref(false);
const amount = ref<number | string | null>(null);
const withdrawing = ref(false);
const formatDateTime = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '______';
};

/** Паевой взнос по программе приходит ассетом цепи: число и тикер раздельно. */
const programShare = computed(() => Number.parseFloat(settlement.value?.program_share ?? '0') || 0);
const share = computed(() => splitAsset2Digits(settlement.value?.program_share ?? ''));
const amountValue = computed(() => Number.parseFloat(String(amount.value ?? '').replace(',', '.')) || 0);
const canWithdraw = computed(() => amountValue.value > 0 && amountValue.value <= programShare.value);

const columns: BaseTableColumn<ISettlementMovement>[] = [
  { key: 'at', label: t('edubridge.teacherSettlementPage.column.at'), width: '150px', nowrap: true },
  { key: 'title', label: t('edubridge.teacherSettlementPage.column.title') },
  { key: 'amount', label: t('edubridge.teacherSettlementPage.column.amount'), numeric: true, width: '170px', nowrap: true },
];

function openWithdraw(): void {
  amount.value = null;
  withdrawOpen.value = true;
}

function goToWallet(): void {
  void router.push({ name: 'wallet', params: { coopname: route.params.coopname } });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [s, h] = await Promise.all([fetchMySettlement(), fetchMySettlementHistory()]);
    settlement.value = s;
    movements.value = h;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onWithdraw(): Promise<void> {
  if (!canWithdraw.value || withdrawing.value) return;
  withdrawing.value = true;
  try {
    settlement.value = await withdrawShare(`${amountValue.value.toFixed(4)} ${share.value.symbol}`);
    amount.value = null;
    withdrawOpen.value = false;
    SuccessAlert(t('edubridge.teacherSettlementPage.withdrawSuccess'));
    await load();
  } catch (e) {
    FailAlert(e);
  } finally {
    withdrawing.value = false;
  }
}

// Живое обновление: взносы по урокам, переводы и выплаты меняют расчёт без перезагрузки.
useLiveReload([EduLive.contributions, EduLive.userWallets], load);

onMounted(load);
</script>

<style scoped>
/* Кошелёк и его действия — в одной карточке, без второй рамки у кошелька. */
.edu-settle__wallet :deep(.wallet) {
  border: 0;
  padding: 0;
  background: transparent;
}
.edu-settle__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2) var(--p-3);
  margin-top: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-settle__move {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
}
.edu-settle__dir {
  flex: none;
}
.edu-settle__dir--in {
  color: var(--p-pos);
}
.edu-settle__dir--out {
  color: var(--p-ink-3);
}
</style>
