<template lang="pug">
//- Что совет видит до документов: сумма и срок, обеспечение, задолженность пайщика.
.loan-decision
  .loan-decision__eyebrow {{ $t('debt.decisionInfo.title') }}
  q-skeleton(v-if='loading', type='rect', height='120px')
  .loan-decision__facts(v-else)
    DataRow(:label='$t("debt.decisionInfo.amountLabel")', :value='formatAmount(meta.amount)', align='spread')
    DataRow(:label='$t("debt.decisionInfo.dueLabel")', :value='formatDate(meta.due_at)', align='spread')
    DataRow(v-if='termDays !== null', :label='$t("debt.decisionInfo.termLabel")', :value='$t("debt.decisionInfo.termValue", { count: termDays })', align='spread')
    DataRow(v-if='meta.collateral', :label='$t("debt.decisionInfo.collateralLabel")', :value='collateralLabel(meta.collateral)', align='spread')
    DataRow(v-if='loan?.pledged', :label='$t("debt.decisionInfo.pledgedLabel")', :value='formatAmount(loan.pledged)', align='spread')
    DataRow(v-if='meta.storage_appendix_number', :label='$t("debt.decisionInfo.storageLabel")', :value='$t("debt.decisionInfo.storageValue", { number: meta.storage_appendix_number })', align='spread')
    DataRow(:label='$t("debt.decisionInfo.payoutLabel")', :value='$t("debt.decisionInfo.payoutValue")', align='spread')
    DataRow(:label='$t("debt.decisionInfo.openLoansLabel")', :value='openLoansValue', align='spread')
    DataRow(v-if='overdueCount', :label='$t("debt.decisionInfo.overdueLabel")', :value='$t("debt.decisionInfo.overdueValue", { count: overdueCount })', align='spread')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Cooperative } from 'cooptypes';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import type { IAgenda } from 'src/entities/Agenda/model';
import { useSystemStore } from 'src/entities/System/model';
import { useLiveReload } from 'src/shared/lib/realtime';
import { getLoan, getLoans, type ILoan } from '../api';
import { DEBT_LIVE_TABLES, amountOf, collateralLabel, daysUntil, formatAmount, formatDate } from '../model';
import { t } from '../i18n';

const props = defineProps<{ agenda: IAgenda }>();
const { info } = useSystemStore();

type StatementMeta = Partial<Cooperative.Registry.GetLoanStatement.Action>;
const meta = computed<StatementMeta>(() => {
  const raw = props.agenda.table?.statement?.meta;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StatementMeta;
  } catch {
    return {};
  }
});

const loading = ref(true);
const loan = ref<ILoan | null>(null);
const openLoans = ref<ILoan[]>([]);

const termDays = computed(() => daysUntil(meta.value.due_at));
const overdueCount = computed(() => openLoans.value.filter((l) => l.status === 'OVERDUE').length);
const openLoansValue = computed(() => {
  if (!openLoans.value.length) return t('debt.decisionInfo.openLoansNone');
  const total = openLoans.value.reduce((sum, l) => sum + amountOf(l.remaining), 0);
  const symbol = String(openLoans.value[0]?.remaining ?? '').split(' ')[1] ?? '';
  return t('debt.decisionInfo.openLoansValue', { count: openLoans.value.length, total: formatAmount(`${total} ${symbol}`) });
});

// Заём по хэшу заявления и открытые займы заёмщика: совет видит все займы кооператива.
async function load(): Promise<void> {
  const username = props.agenda.table?.username;
  try {
    const [one, list] = await Promise.all([
      meta.value.debt_hash ? getLoan(meta.value.debt_hash).catch(() => null) : Promise.resolve(null),
      username
        ? getLoans({ filter: { coopname: info.coopname, username, outstanding: true }, options: { page: 1, limit: 50 } })
        : Promise.resolve(null),
    ]);
    loan.value = one;
    openLoans.value = list?.items ?? [];
  } finally {
    loading.value = false;
  }
}

useLiveReload(DEBT_LIVE_TABLES, () => void load());
onMounted(load);
</script>

<style scoped lang="scss">
.loan-decision {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.loan-decision__eyebrow {
  color: var(--p-ink-2);
  font-size: var(--p-fs-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
}

.loan-decision__facts {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
</style>
