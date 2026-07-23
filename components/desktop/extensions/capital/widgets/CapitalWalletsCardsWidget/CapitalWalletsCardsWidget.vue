<template lang="pug">
//- Кошельки программ Благороста — канон-карточки WalletCard в две колонки
.row.q-col-gutter-md
  .col-12.col-md-6
    WalletCard(
      program='generator',
      :balance='generatorWallet.amount',
      :symbol='generatorWallet.symbol',
      balance-label='Всего'
    )
  .col-12.col-md-6
    WalletCard(
      program='blagorost',
      :balance='blagorostWallet.amount',
      :symbol='blagorostWallet.symbol',
      balance-label='Всего'
    )
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useWalletStore } from 'src/entities/Wallet/model';
import { useSystemStore } from 'src/entities/System/model';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { Zeus } from '@coopenomics/sdk';

const walletStore = useWalletStore();
const { info } = useSystemStore();

// WalletCard принимает сумму и тикер раздельно
function splitAsset(asset?: string | null): { amount: string; symbol: string } {
  const fallbackSymbol = info?.symbols?.root_govern_symbol || 'RUB';
  if (!asset) return { amount: '0,00', symbol: fallbackSymbol };
  const formatted = formatAsset2Digits(asset);
  const parts = formatted.split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || fallbackSymbol };
}

function findProgramWallet(type: Zeus.ProgramType) {
  return walletStore.program_wallets.find(
    (wallet) =>
      wallet.program_details.program_type.toLowerCase() === type.toLowerCase(),
  );
}

// Кошелёк генерации
const generatorWallet = computed(() =>
  splitAsset(findProgramWallet(Zeus.ProgramType.GENERATOR)?.available),
);

// Кошелёк Благороста
const blagorostWallet = computed(() =>
  splitAsset(findProgramWallet(Zeus.ProgramType.BLAGOROST)?.available),
);
</script>

