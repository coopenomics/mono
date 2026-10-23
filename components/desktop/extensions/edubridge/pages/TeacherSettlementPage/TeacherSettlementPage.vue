<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-settlement:banner-dismissed")
    | {{ $t('edubridge.teacherSettlementPage.hintAccrual') }}
    | {{ $t('edubridge.teacherSettlementPage.hintReturn') }}

  //- Один кошелёк и одно действие: возврат на реквизиты, перевод в Цифровой Кошелёк идёт внутри него.
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
      BaseButton(variant="primary" :disabled="!settlement || programShare <= 0" @click="returnOpen = true")
        template(#icon-left)
          q-icon(name="payments" size="18px")
        | {{ $t('edubridge.teacherSettlementPage.returnButton') }}
      .t-sm.t-muted(v-if="settlement && programShare <= 0") {{ $t('edubridge.teacherSettlementPage.nothingToReturn') }}

  //- Выписка: зачисления по принятым результатам и возвраты с состоянием — строка открывает подробности.
  .t-h3.q-mt-lg.q-mb-sm {{ $t('edubridge.teacherSettlementPage.historyTitle') }}
  BaseTable(
    v-if="firstLoad || entries.length"
    :columns="columns"
    :rows="entries"
    row-key="id"
    :loading="firstLoad"
    min-width="720px"
    clickable-rows
    @row-click="openEntry"
  )
    template(#cell-at="{ row }") {{ formatDateTime(row.at) }}
    template(#cell-title="{ row }")
      .edu-settle__move
        q-icon.edu-settle__dir(:name="isIncomingEntry(row) ? 'south_west' : 'north_east'" :class="isIncomingEntry(row) ? 'edu-settle__dir--in' : 'edu-settle__dir--out'" size="16px")
        span {{ row.title }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row).variant") {{ statusOf(row).label }}
    template(#cell-amount="{ row }")
      span.t-num(:class="isIncomingEntry(row) ? 't-pos' : ''") {{ isIncomingEntry(row) ? '+' : '−' }} {{ formatAsset2Digits(row.amount) }}
  EmptyState(v-else :title="$t('edubridge.teacherSettlementPage.historyEmptyTitle')" :body="$t('edubridge.teacherSettlementPage.historyEmptyBody')")
    template(#icon)
      q-icon(name="receipt_long" size="32px")

  ShareReturnDialog(v-model="returnOpen" :available="programShare" :symbol="share.symbol" @done="load")

  DetailsDrawer(v-model="detailsOpen" :title="details?.title || ''" :width="640")
    template(v-if="details")
      ContributionDetails(v-if="detailsContribution" :contribution="detailsContribution" scope="own")
      ShareReturnDetails(v-else-if="!isIncomingEntry(details) && details.return_id" :entry="details")
      .t-muted.t-sm(v-else) {{ $t('edubridge.teacherSettlementPage.noDetails') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DetailsDrawer, PageHint, WalletCard } from 'src/shared/ui/domain';
import {
  SETTLEMENT_STATUS_LABELS,
  fetchMyContributions,
  fetchMySettlement,
  fetchMySettlementJournal,
  isIncomingEntry,
  type IContribution,
  type ISettlement,
  type ISettlementEntry,
} from '../../entities/Teacher';
import { ShareReturnDialog } from '../../features/ShareReturn';
import { ContributionDetails } from '../../widgets/ContributionDetails';
import { ShareReturnDetails } from '../../widgets/ShareReturnDetails';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Расчёт с преподавателем: паевой взнос по программе одним кошельком, возврат
 * на реквизиты одной кнопкой, под ними выписка — что зачислено по принятым
 * результатам и в каком состоянии каждый возврат.
 */
const settlement = ref<ISettlement | null>(null);
const entries = ref<ISettlementEntry[]>([]);
const contributions = ref<IContribution[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const returnOpen = ref(false);
const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => entries.value.find((e) => e.id === detailsId.value) ?? null);
const detailsContribution = computed<IContribution | null>(() => {
  const id = details.value?.contribution_id;
  return id ? (contributions.value.find((c) => asText(c.id) === asText(id)) ?? null) : null;
});
const formatDateTime = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '______';
};

/** Паевой взнос по программе приходит ассетом цепи: число и тикер раздельно. */
const programShare = computed(() => Number.parseFloat(settlement.value?.program_share ?? '0') || 0);
const share = computed(() => splitAsset2Digits(settlement.value?.program_share ?? ''));
const statusOf = (row: ISettlementEntry) => SETTLEMENT_STATUS_LABELS[row.status] ?? { label: row.status, variant: 'neutral' as const };

const columns: BaseTableColumn<ISettlementEntry>[] = [
  { key: 'at', label: t('edubridge.teacherSettlementPage.column.at'), width: '150px', nowrap: true },
  { key: 'title', label: t('edubridge.teacherSettlementPage.column.title') },
  { key: 'status', label: t('edubridge.teacherSettlementPage.column.status'), width: '200px', nowrap: true },
  { key: 'amount', label: t('edubridge.teacherSettlementPage.column.amount'), numeric: true, width: '170px', nowrap: true },
];

function openEntry(row: ISettlementEntry): void {
  detailsId.value = row.id;
  detailsOpen.value = true;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [s, journal, mine] = await Promise.all([fetchMySettlement(), fetchMySettlementJournal(), fetchMyContributions()]);
    settlement.value = s;
    entries.value = journal;
    contributions.value = mine;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// Живое обновление: взносы по занятиям, возвраты, решения совета и выплаты меняют расчёт без перезагрузки.
useLiveReload([EduLive.contributions, EduLive.userWallets, EduLive.shareReturns, EduLive.payments], load);

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
