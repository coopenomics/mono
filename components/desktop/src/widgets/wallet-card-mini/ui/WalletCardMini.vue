<template>
  <WalletCard
    :program="program"
    :balance="balanceStr"
    :symbol="symbolStr"
    :locked-balance="lockedStr"
    :loading="isLoading"
    :compact="compact"
    style="cursor: pointer"
    @click="goToWallet"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import type { WalletProgram } from 'src/shared/ui/domain/WalletCard';

interface Props {
  /** Какую программу показывать. Default 'wallet' = главный кошелёк (свободный остаток) */
  program?: WalletProgram;
  /** Compact-вариант (для слота шапки). Default true */
  compact?: boolean;
  /** Внешнее управление loading. Если undefined — определяется по наличию данных в store */
  loading?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  program: 'wallet',
  compact: true,
});

const router = useRouter();
const walletStore = useWalletStore();
const { info } = useSystemStore();

const programToZeus: Record<WalletProgram, Zeus.ProgramType> = {
  wallet: Zeus.ProgramType.MAIN,
  blagorost: Zeus.ProgramType.BLAGOROST,
  generator: Zeus.ProgramType.GENERATOR,
};

const walletEntry = computed(() =>
  walletStore.program_wallets.find((w) => w.program_type === programToZeus[props.program]),
);

const isLoading = computed(() =>
  props.loading !== undefined ? props.loading : walletStore.program_wallets.length === 0,
);

function splitAsset(asset?: string | null): { amount: string; symbol: string } {
  if (!asset) return { amount: '0,00', symbol: '' };
  const formatted = formatAsset2Digits(asset);
  const parts = formatted.split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || '' };
}

const available = computed(() => splitAsset(walletEntry.value?.available));
const balanceStr = computed(() => available.value.amount);
const symbolStr = computed(
  () => available.value.symbol || info.symbols?.root_govern_symbol || 'RUB',
);

const lockedStr = computed(() => {
  const split = splitAsset(walletEntry.value?.blocked);
  if (split.amount === '0,00' || split.amount === '0.00') return undefined;
  return split.amount;
});

function goToWallet(): void {
  void router.push({ name: 'wallet' });
}
</script>
