<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-settlement:banner-dismissed")
    | {{ $t('edubridge.teacherSettlementPage.hintAccrual') }}
    | {{ $t('edubridge.teacherSettlementPage.hintReturn') }}

  //- Четыре числа расчёта одной полосой по пути денег: принято советом →
  //- зачислено паевым взносом → доступно в кошельке; последний взнос — дата.
  StatStrip(:items="stats" :loading="!settlement")

  //- Перевод в Цифровой Кошелёк — когда есть что переводить; рядом вход в возврат.
  .row.q-col-gutter-md.q-mt-md
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
        .row.justify-end.q-mt-md
          BaseButton(variant="primary" :loading="withdrawing" :disabled="!canWithdraw" @click="onWithdraw") {{ $t('edubridge.teacherSettlementPage.withdrawButton') }}
    .col-12.col-md-6
      BaseCard(variant="default" :title="$t('edubridge.teacherSettlementPage.returnTitle')")
        .t-sm.t-muted {{ $t('edubridge.teacherSettlementPage.hintReturn') }}
        .row.justify-end.q-mt-md
          BaseButton(variant="secondary" @click="goToWallet")
            template(#icon-left)
              q-icon(name="account_balance_wallet" size="18px")
            | {{ $t('edubridge.teacherSettlementPage.walletReturnButton') }}

  //- Из чего сложилась сумма: принятые советом взносы, строка открывает взнос.
  .t-h3.q-mt-lg.q-mb-sm {{ $t('edubridge.teacherSettlementPage.acceptedTitle') }}
  BaseTable(
    v-if="firstLoad || accepted.length"
    :columns="columns"
    :rows="accepted"
    row-key="id"
    :loading="firstLoad"
    :clickable-rows="true"
    min-width="640px"
    @row-click="openDetails"
  )
    template(#cell-description="{ row }")
      .edu-settle__title {{ row.description || '______' }}
      .t-muted.t-sm {{ ridType(row.rid_type) }}
    template(#cell-decided_at="{ row }") {{ formatDate(row.decided_at || row.created_at) }}
    template(#cell-amount="{ row }")
      span.t-num {{ formatAsset2Digits(row.amount) }}
  EmptyState(v-else :title="$t('edubridge.teacherSettlementPage.acceptedEmptyTitle')" :body="$t('edubridge.teacherSettlementPage.acceptedEmptyBody')")
    template(#icon)
      q-icon(name="workspace_premium" size="32px")

  DetailsDrawer(v-model="detailsOpen" :title="details?.description || $t('edubridge.teacherSettlementPage.acceptedTitle')" :width="560")
    ContributionDetails(v-if="details" :contribution="details")
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { AmountInput, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { RID_TYPE_LABELS, fetchMyContributions, fetchMySettlement, withdrawShare, type IContribution, type ISettlement } from '../../entities/Teacher';
import { ContributionDetails } from '../../widgets/ContributionDetails';
import { StatStrip, type StatStripItem } from '../../shared/ui/StatStrip';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Расчёт с преподавателем: сколько принято советом, сколько зачислено паевым
 * взносом по программе и сколько уже доступно в кошельке. Под числами —
 * принятые взносы: из них сумма и сложилась.
 */
const route = useRoute();
const router = useRouter();
const settlement = ref<ISettlement | null>(null);
const contributions = ref<IContribution[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const amount = ref<number | string | null>(null);
const withdrawing = ref(false);
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};
const ridType = (k: string) => RID_TYPE_LABELS[k] ?? k;

/** Паевой взнос по программе приходит ассетом цепи: число и тикер раздельно. */
const programShare = computed(() => Number.parseFloat(settlement.value?.program_share ?? '0') || 0);
const symbol = computed(() => settlement.value?.program_share.split(' ')[1] ?? '');
const amountValue = computed(() => Number.parseFloat(String(amount.value ?? '').replace(',', '.')) || 0);
const canWithdraw = computed(() => amountValue.value > 0 && amountValue.value <= programShare.value);

const money = (v: string | undefined) => splitAsset2Digits(v ?? '');
const stats = computed<StatStripItem[]>(() => {
  const s = settlement.value;
  return [
    { key: 'accepted', icon: 'workspace_premium', caption: t('edubridge.teacherSettlementPage.acceptedTotalLabel'), value: money(s?.accepted_total).amount, symbol: money(s?.accepted_total).symbol, sub: t('edubridge.teacherSettlementPage.acceptedTotalSub', { n: accepted.value.length }, accepted.value.length) },
    { key: 'share', icon: 'school', caption: t('edubridge.teacherSettlementPage.programShareLabel'), value: money(s?.program_share).amount, symbol: money(s?.program_share).symbol, sub: t('edubridge.teacherSettlementPage.programShareSub') },
    { key: 'available', icon: 'account_balance_wallet', caption: t('edubridge.teacherSettlementPage.availableLabel'), value: money(s?.available).amount, symbol: money(s?.available).symbol, sub: t('edubridge.teacherSettlementPage.availableSub') },
    { key: 'last', icon: 'event_available', caption: t('edubridge.teacherSettlementPage.lastAcceptedLabel'), value: s?.last_accepted_at ? formatDate(s.last_accepted_at) : '______', sub: t('edubridge.teacherSettlementPage.lastAcceptedSub') },
  ];
});

/** Принятые советом взносы — свежие сверху. */
const accepted = computed(() =>
  contributions.value
    .filter((c) => c.status === Zeus.EduContributionStatus.ACCEPTED)
    .sort((a, b) => String(b.decided_at ?? b.created_at).localeCompare(String(a.decided_at ?? a.created_at))),
);
const columns: BaseTableColumn<IContribution>[] = [
  { key: 'description', label: t('edubridge.teacherSettlementPage.column.contribution') },
  { key: 'decided_at', label: t('edubridge.teacherSettlementPage.column.decidedAt'), width: '140px', nowrap: true },
  { key: 'amount', label: t('edubridge.teacherSettlementPage.column.amount'), numeric: true, width: '160px', nowrap: true },
];

const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => contributions.value.find((c) => asText(c.id) === detailsId.value) ?? null);
function openDetails(row: IContribution): void {
  detailsId.value = asText(row.id);
  detailsOpen.value = true;
}

function goToWallet(): void {
  void router.push({ name: 'wallet', params: { coopname: route.params.coopname } });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [s, c] = await Promise.all([fetchMySettlement(), fetchMyContributions()]);
    settlement.value = s;
    contributions.value = c;
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
useLiveReload([EduLive.contributions, EduLive.userWallets], load);

onMounted(load);
</script>

<style scoped>
.edu-settle__title {
  font-weight: 600;
  color: var(--p-ink);
}
</style>
