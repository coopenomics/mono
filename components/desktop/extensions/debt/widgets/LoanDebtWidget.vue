<template lang="pug">
//- Задолженность пайщика по займам на странице программы. Зоны: число —
//- «сколько должен», строки займов — «по каким договорам и до какого срока»,
//- действие — переход в займы. Без непогашенных займов виджет не показывается.
BaseCard.debt-widget(v-if='loans.length', :title='$t("debt.debtWidget.title")')
  .debt-widget__body
    .debt-widget__total
      .debt-widget__amount {{ formatAmount(totalAsset) }}
      .debt-widget__caption {{ $t('debt.debtWidget.totalCaption') }}
      .debt-widget__caption {{ $t('debt.debtWidget.loansCaption', { count: loans.length }) }}
      .debt-widget__caption.text-negative(v-if='overdue > 0') {{ $t('debt.debtWidget.overdueCaption', { amount: formatAmount(overdueAsset) }) }}

    .debt-widget__rows
      .debt-widget__row(v-for='loan in loans', :key='loan.debt_hash')
        .debt-widget__identity
          .debt-widget__title {{ $t('debt.debtWidget.rowTitle', { number: loan.contract_number }) }}
          .debt-widget__caption {{ rowMeta(loan) }}
        .debt-widget__remaining {{ formatAmount(loan.remaining) }}
        BaseBadge(:variant='loanStatusVariant(loan.status)') {{ loanStatusLabel(loan.status) }}

  .debt-widget__actions(v-if='canOpen')
    BaseButton(variant='secondary', size='sm', @click='openLoans') {{ $t('debt.debtWidget.openAction') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop';
import { useSystemStore } from 'src/entities/System/model';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { getLoans, type ILoan } from '../api';
import {
  DEBT_LIVE_TABLES,
  amountOf,
  formatAmount,
  formatDate,
  loanStatusLabel,
  loanStatusVariant,
  sourceLabel,
} from '../model';
import { t } from '../i18n';

const route = useRoute();
const router = useRouter();
const system = useSystemStore();
const desktop = useDesktopStore();

const loans = ref<ILoan[]>([]);

const symbol = computed(() => String(loans.value[0]?.remaining ?? '').split(' ')[1] ?? '');
const total = computed(() => loans.value.reduce((sum, loan) => sum + amountOf(loan.remaining), 0));
const overdue = computed(() =>
  loans.value.filter((loan) => loan.status === 'OVERDUE').reduce((sum, loan) => sum + amountOf(loan.remaining), 0),
);
const totalAsset = computed(() => `${total.value} ${symbol.value}`);
const overdueAsset = computed(() => `${overdue.value} ${symbol.value}`);

// Переход в займы — когда у пайщика есть право на свои займы.
const canOpen = computed(() => desktop.hasGrant('debt', 'Loan:read:own'));

function rowMeta(loan: ILoan): string {
  return [sourceLabel(loan.source), t('debt.debtWidget.rowDue', { date: formatDate(loan.due_at) })]
    .filter(Boolean)
    .join(' · ');
}

// Виджет дополняет чужую страницу: сбой запроса (приложение займов не
// установлено) оставляет его скрытым и страницу не тревожит.
async function load(): Promise<void> {
  try {
    const result = await getLoans({
      filter: { coopname: system.info.coopname, outstanding: true } as never,
      options: { page: 1, limit: 50, sortBy: 'due_at', sortOrder: 'ASC' },
    });
    loans.value = result.items;
  } catch {
    loans.value = [];
  }
}

function openLoans(): void {
  void router.push({ name: 'debt-loans', params: { coopname: route.params.coopname } });
}

useLiveReload(DEBT_LIVE_TABLES, load);
onMounted(load);
</script>

<style scoped lang="scss">
.debt-widget__body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--p-6);
  align-items: start;
}

.debt-widget__amount {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  color: var(--p-ink);
  white-space: nowrap;
}

.debt-widget__caption {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.debt-widget__rows {
  display: flex;
  flex-direction: column;
}

.debt-widget__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--p-4);
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);

  &:last-child {
    border-bottom: none;
  }
}

.debt-widget__title {
  font-weight: 600;
  color: var(--p-ink);
}

.debt-widget__remaining {
  font-weight: 600;
  white-space: nowrap;
  color: var(--p-ink);
}

.debt-widget__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--p-4);
}

@media (max-width: 720px) {
  .debt-widget__body {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--p-4);
  }
}
</style>
