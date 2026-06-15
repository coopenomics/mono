<template lang="pug">
q-page.program-expenses-page
  //- Действия страницы — в топбар через canon Teleport в слот-host шапки.
  //- На мобильном — micro-вариант (иконка + tooltip).
  Teleport(to='#header-actions-host', defer)
    q-btn(
      @click='openCreate',
      :color='isMobile ? "accent" : "primary"',
      :flat='isMobile',
      :dense='isMobile',
      :size='isMobile ? "sm" : undefined',
      no-wrap
    )
      q-icon(name='add')
      span.q-ml-sm(v-if='!isMobile') Создать расход
      q-tooltip(v-if='isMobile') Создать расход
    q-btn(
      @click='openTopup',
      color='primary',
      flat,
      :dense='isMobile',
      :size='isMobile ? "sm" : undefined',
      no-wrap
    )
      q-icon(name='account_balance_wallet')
      span.q-ml-sm(v-if='!isMobile') Пополнить пул
      q-tooltip(v-if='isMobile') Пополнить пул

  .pools.row.q-col-gutter-md
    .col-12.col-md-6
      WalletCard(
        neutral,
        title='Инвест-пул',
        subtitle='Источник пополнения',
        balance-label='Доступно к распределению',
        :balance='globalPool.amount',
        :symbol='globalPool.symbol',
        icon='savings',
        :loading='!configStore.state'
      )
    .col-12.col-md-6
      WalletCard(
        program='blagorost',
        title='Пул расходов',
        subtitle='Кошелёк, с которого оплачиваются программные расходы',
        balance-label='Доступно',
        :balance='expensePool.amount',
        :symbol='expensePool.symbol',
        icon='receipt_long',
        :loading='!expenseWallet'
      )

  //- Общий виджет шасси: страница только готовит строки из своего запроса.
  ExpenseProposalList(
    :rows='listRows',
    :loading='loading',
    empty-title='Программных расходов пока нет',
    @open='openExpense'
  )

  CreateProgramExpenseDialog(
    v-model='createOpen',
    @created='refresh'
  )
  TopupProgramExpensePoolDialog(
    v-model='topupOpen',
    @topped-up='refresh'
  )
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useWindowSize } from 'src/shared/hooks';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { ExpenseProposalList } from 'src/shared/ui/domain/ExpenseProposalList';
import type { ExpenseProposalListRow } from 'src/shared/ui/domain/ExpenseProposalList';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useLedger2Store } from 'src/entities/Ledger2';
import { useProgramExpenseStore } from 'app/extensions/capital/entities/ProgramExpense/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import { CreateProgramExpenseDialog } from 'app/extensions/capital/features/ProgramExpense/CreateProgramExpense/ui';
import { TopupProgramExpensePoolDialog } from 'app/extensions/capital/features/ProgramExpense/TopupPool/ui';

const system = useSystemStore();
const store = useProgramExpenseStore();
const configStore = useConfigStore();
const ledger2Store = useLedger2Store();
const { isMobile } = useWindowSize();

const coopname = computed(() => system.info.coopname);
const createOpen = ref(false);
const topupOpen = ref(false);

function openCreate(): void { createOpen.value = true; }
function openTopup(): void { topupOpen.value = true; }

function splitAsset(asset?: string | null): { amount: string; symbol: string } {
  const fallbackSymbol = system.info?.symbols?.root_govern_symbol ?? 'RUB';
  if (!asset) return { amount: '0,00', symbol: fallbackSymbol };
  const parts = formatAsset2Digits(asset).split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || fallbackSymbol };
}

const globalPool = computed(() =>
  splitAsset(configStore.state?.global_available_invest_pool),
);

// «Доступно» = остаток кошелька, с которого оплата реально списывается при
// payexp (source_wallet). Раньше показывали счётчик program_expense_pool — он
// расходится с балансом кошелька (счётчик двигается на резерве, кошелёк — на
// оплате), из-за чего кассир видел одну сумму, а оплата обламывалась на другой.
const PROGRAM_EXPENSE_WALLET = 'w.cap.pgexp';
const expenseWallet = computed(() => ledger2Store.getWalletByName(PROGRAM_EXPENSE_WALLET));
const expensePool = computed(() => splitAsset(expenseWallet.value?.available));

const loading = ref(false);
async function refresh(): Promise<void> {
  try {
    loading.value = true;
    await Promise.all([
      store.loadProgramExpenses({ coopname: coopname.value }),
      configStore.loadState({ coopname: coopname.value }),
      ledger2Store.loadWallets(coopname.value),
    ]);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);

// Строки для общего виджета списка СЗ — из capital-запроса программных расходов.
const listRows = computed<ExpenseProposalListRow[]>(() =>
  (store.programExpenses?.items ?? []).map((item) => ({
    expense_hash: item.expense_hash,
    title: item.items[0]?.description ?? '',
    status: item.status,
    total_planned: formatAsset2Digits(item.total_planned),
    creator_name: item.creator_name || item.creator,
    created_at: item.created_at,
  })),
);

const router = useRouter();
function openExpense(expenseHash: string): void {
  router.push({ name: 'capital-program-expense', params: { expense_hash: expenseHash } });
}
</script>

<style lang="scss" scoped>
.program-expenses-page {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .program-expenses-page {
    padding: var(--p-4, 16px);
  }
}

.pools {
  margin-bottom: var(--p-5);
}
</style>
