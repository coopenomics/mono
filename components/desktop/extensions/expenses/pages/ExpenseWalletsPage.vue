<template lang="pug">
q-page.expense-wallets-page
  .banner.banner--info
    .banner__icon
      q-icon(name='info', size='20px')
    .banner__body
      | Кошельки-пулы, из которых кооператив ведёт расходы. Каждый пул подключает
      | своё расширение: нажмите на карточку, чтобы открыть реестр расходов пула.

  .row.q-col-gutter-md(v-if='entries.length')
    .col-12.col-md-6.col-lg-4(v-for='entry in walletRows', :key='entry.wallet')
      .wallet-link(role='button', tabindex='0', @click='open(entry)', @keydown.enter='open(entry)')
        WalletCard(
          :program='entry.program',
          :neutral='!entry.program',
          :title='entry.title',
          :subtitle='entry.subtitle',
          balance-label='Доступно',
          :balance='entry.balance',
          :symbol='entry.symbol',
          :icon='entry.icon',
          :loading='loading'
        )

  .empty(v-else)
    EmptyState(
      title='Кошельков расходов пока нет',
      body='Ни одно расширение не подключило пул расходов на этом кооперативе.'
    )
      template(#icon)
        q-icon(name='account_balance_wallet', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSystemStore } from 'src/entities/System/model';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import {
  listExpenseWallets,
  type ExpenseWalletEntry,
} from 'src/shared/lib/expense-wallets';

const system = useSystemStore();
const router = useRouter();

const entries = listExpenseWallets();
const balances = ref<Record<string, string>>({});
const loading = ref(false);

onMounted(async () => {
  try {
    loading.value = true;
    const { [Queries.Ledger2.GetLedger2Wallets.name]: wallets } = await client.Query(
      Queries.Ledger2.GetLedger2Wallets.query,
      { variables: { coopname: system.info.coopname } },
    );
    balances.value = Object.fromEntries(
      (wallets ?? []).map((w) => [w.name, w.available]),
    );
  } catch {
    // Балансы — вспомогательные: их отказ не прячет список пулов.
  } finally {
    loading.value = false;
  }
});

function splitAsset(asset?: string): { amount: string; symbol: string } {
  const fallbackSymbol = system.info?.symbols?.root_govern_symbol ?? 'RUB';
  if (!asset) return { amount: '0,00', symbol: fallbackSymbol };
  const parts = formatAsset2Digits(asset).split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || fallbackSymbol };
}

const walletRows = computed(() =>
  entries.map((entry) => {
    const { amount, symbol } = splitAsset(balances.value[entry.wallet]);
    return { ...entry, balance: amount, symbol };
  }),
);

function open(entry: ExpenseWalletEntry): void {
  void router.push(entry.route);
}
</script>

<style lang="scss" scoped>
.expense-wallets-page {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

@media (max-width: 768px) {
  .expense-wallets-page {
    padding: var(--p-4, 16px);
  }
}

.wallet-link {
  cursor: pointer;
  outline: none;
  border-radius: var(--p-r-lg);

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--p-primary);
  }
}

.empty {
  margin-top: var(--p-6);
}
</style>
