<template lang="pug">
//- Зоны строки: опознание — «какой заём», деньги — «сколько», состояние —
//- «в каком состоянии и до какого срока». Действия живут в правой панели:
//- строка открывает её по нажатию.
.loan-row(role='button', tabindex='0', @click='$emit("open", loan)', @keydown.enter='$emit("open", loan)')
  .loan-row__identity
    .loan-row__title {{ $t('debt.loanRow.title', { number: loan.contract_number }) }}
    .loan-row__meta {{ meta }}
  .loan-row__money
    .loan-row__amount {{ money }}
    .loan-row__caption {{ moneyCaption }}
  .loan-row__state
    BaseBadge(:variant='loanStatusVariant(loan.status)') {{ loanStatusLabel(loan.status) }}
    .loan-row__caption(v-if='stateCaption') {{ stateCaption }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import type { ILoan } from '../api';
import {
  collateralLabel,
  formatAmount,
  formatDate,
  isOutstanding,
  loanStatusLabel,
  loanStatusVariant,
  sourceLabel,
} from '../model';
import { t } from '../i18n';

const props = defineProps<{ loan: ILoan }>();
defineEmits<{ (e: 'open', loan: ILoan): void }>();

const meta = computed(() =>
  [
    t('debt.loanRow.metaDate', { date: formatDate(props.loan.created_at) }),
    collateralLabel(props.loan.collateral) || sourceLabel(props.loan.source),
  ]
    .filter(Boolean)
    .join(' · '),
);

// Выданный заём показывает остаток, остальные — сумму займа.
const outstanding = computed(() => isOutstanding(props.loan.status));
const money = computed(() => formatAmount(outstanding.value ? props.loan.remaining : props.loan.amount));
const moneyCaption = computed(() =>
  outstanding.value ? t('debt.loanRow.remainingCaption') : t('debt.loanRow.amountCaption'),
);

// Под бейджем — только новое: срок возврата.
const stateCaption = computed(() => {
  if (props.loan.status === 'CLOSED' || props.loan.status === 'DECLINED') return '';
  const date = formatDate(props.loan.due_at);
  if (!date) return '';
  return outstanding.value ? t('debt.loanRow.dueUntil', { date }) : t('debt.loanRow.dueRequested', { date });
});
</script>

<style scoped lang="scss">
.loan-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas: 'identity money state';
  align-items: center;
  gap: var(--p-6);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  background: var(--p-surface);
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--p-primary-line);
    outline: none;
  }
}

.loan-row__identity {
  grid-area: identity;
  min-width: 0;
}

.loan-row__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.loan-row__meta,
.loan-row__caption {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.loan-row__money {
  grid-area: money;
  text-align: right;
}

.loan-row__amount {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  color: var(--p-ink);
  white-space: nowrap;
}

.loan-row__state {
  grid-area: state;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-1);
  min-width: 220px;
}

@media (max-width: 720px) {
  .loan-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'identity money'
      'state state';
    gap: var(--p-3);
  }

  .loan-row__state {
    align-items: flex-start;
    min-width: 0;
  }
}
</style>
