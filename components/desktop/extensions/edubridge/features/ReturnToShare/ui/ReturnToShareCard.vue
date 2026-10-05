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
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { WalletCard } from 'src/shared/ui/domain';
import { fetchReturnBalance } from '../api';
import type { IReturnBalance } from '../model';
import { useLiveReload } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { EduLive } from '../../../shared/lib/live';

/**
 * Остаток кошелька программы. Отдельного выхода из программы нет: остаток
 * возвращается на паевой взнос только при выходе пайщика из кооператива, и
 * подаётся он там же, поэтому здесь карточка лишь показывает сумму.
 */
const { info } = useSystemStore();
const balance = ref<IReturnBalance | null>(null);

/** Карточка кошелька принимает сумму и тикер раздельно. */
const wallet = computed(() => {
  const [amount = '0,00', symbol = info?.symbols?.root_govern_symbol ?? ''] = formatAsset2Digits(balance.value?.available ?? '').split(/\s+(?=\S+$)/);
  return { amount, symbol, isEmpty: !Number.parseFloat(String(balance.value?.available ?? '0')) };
});

async function load(): Promise<void> {
  try {
    balance.value = await fetchReturnBalance();
  } catch (e) {
    FailAlert(e);
  }
}

// Живое обновление: остаток меняется в цепи при взносах и возвратах.
useLiveReload([EduLive.userWallets], load);

onMounted(load);
</script>
