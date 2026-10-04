<template lang="pug">
.edu-wallet
  WalletCard(
    neutral
    icon="school"
    :title="$t('edubridge.returnToShareCard.title')"
    :subtitle="$t('edubridge.returnToShareCard.programName')"
    :hint="$t('edubridge.returnToShareCard.balanceHint')"
    :balance="wallet.amount"
    :symbol="wallet.symbol"
    :balance-label="$t('edubridge.returnToShareCard.balanceLabel')"
    :loading="!balance"
    :empty="wallet.isEmpty"
  )
  .t-meta.t-muted.q-mt-sm(v-if="balance?.has_pending") {{ $t('edubridge.returnToShareCard.pendingNotice') }}

  BaseTable.q-mt-md(v-if="requests.length" :columns="columns" :rows="requests" row-key="id" min-width="480px")
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-meta.t-muted(v-if="row.decline_reason") {{ row.decline_reason }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain';
import { fetchMyReturnRequests, fetchReturnBalance } from '../api';
import { RETURN_STATUS_LABELS, type IReturnBalance, type IReturnRequest } from '../model';
import { useLiveReload } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { EduLive } from '../../../shared/lib/live';
import { t } from '../../../i18n';

/**
 * Остаток кошелька программы и ход уже поданных заявлений о прекращении участия.
 * Само прекращение участия здесь не подаётся: его место — список программ на
 * столе пайщика и выход из кооператива (решение владельца 04.10.2026).
 */
const { info } = useSystemStore();
const balance = ref<IReturnBalance | null>(null);
const requests = ref<IReturnRequest[]>([]);

const columns: BaseTableColumn<IReturnRequest>[] = [
  { key: 'created_at', label: t('edubridge.returnToShareCard.columns.submitted'), width: '120px', nowrap: true },
  { key: 'amount', label: t('edubridge.returnToShareCard.columns.amount'), numeric: true, width: '140px', nowrap: true },
  { key: 'status', label: t('edubridge.returnToShareCard.columns.status') },
];

/** Карточка кошелька принимает сумму и тикер раздельно. */
const wallet = computed(() => {
  const [amount = '0,00', symbol = info?.symbols?.root_govern_symbol ?? ''] = formatAsset2Digits(balance.value?.available ?? '').split(/\s+(?=\S+$)/);
  return { amount, symbol, isEmpty: !Number.parseFloat(String(balance.value?.available ?? '0')) };
});

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

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.returnRequests, EduLive.userWallets], load);

onMounted(load);
</script>
