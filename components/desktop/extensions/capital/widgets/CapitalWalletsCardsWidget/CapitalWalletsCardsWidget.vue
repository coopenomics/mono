<template lang="pug">
//- Слева — кошелёк ЦПП «Благорост»; справа — прирост, полученный из программы
//- (не взнос участника). Генератор на профиле не показываем.
.capital-wallets
  .col
    WalletCard(
      program='blagorost',
      :balance='blagorostWallet.amount',
      :symbol='blagorostWallet.symbol',
      balance-label='Всего'
    )
  .col
    WalletCard(
      program='blagorost',
      title='Получено в Благорост',
      :balance='receivedFromBlagorost.amount',
      :symbol='receivedFromBlagorost.symbol',
      balance-label='Прирост',
      icon='trending_up',
      :empty='receivedFromBlagorost.isEmpty'
    )
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useWalletStore } from 'src/entities/Wallet/model';
import { useSystemStore } from 'src/entities/System/model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { Zeus } from '@coopenomics/sdk';

const walletStore = useWalletStore();
const contributorStore = useContributorStore();
const { info } = useSystemStore();

function splitAsset(asset?: string | null): {
  amount: string;
  symbol: string;
  isEmpty: boolean;
} {
  const fallbackSymbol = info?.symbols?.root_govern_symbol || 'RUB';
  if (!asset) return { amount: '0,00', symbol: fallbackSymbol, isEmpty: true };
  const formatted = formatAsset2Digits(asset);
  const parts = formatted.split(' ');
  const amount = parts[0] || '0,00';
  const symbol = parts[1] || fallbackSymbol;
  const numeric = parseFloat(String(asset).replace(',', '.').split(' ')[0] || '0');
  return {
    amount,
    symbol,
    isEmpty: !Number.isFinite(numeric) || numeric === 0,
  };
}

function findProgramWallet(type: Zeus.ProgramType) {
  return walletStore.program_wallets.find(
    (wallet) => wallet.program_type?.toLowerCase() === type.toLowerCase(),
  );
}

const blagorostWallet = computed(() =>
  splitAsset(findProgramWallet(Zeus.ProgramType.BLAGOROST)?.available),
);

const receivedFromBlagorost = computed(() => {
  const raw = contributorStore.self?.contributed_as_contributor;
  if (!raw) return splitAsset(null);
  // В DTO сумма уже с тикером («0.0000 RUB») либо голое число
  const hasSymbol = /\s[A-Z]{3,7}$/.test(String(raw).trim());
  const asset = hasSymbol
    ? String(raw)
    : `${raw} ${info?.symbols?.root_govern_symbol || 'RUB'}`;
  return splitAsset(asset);
});
</script>

<style lang="scss" scoped>
.capital-wallets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-3);
}

.col {
  min-width: 0;
}

@media (max-width: 600px) {
  .capital-wallets {
    grid-template-columns: 1fr;
  }
}
</style>
