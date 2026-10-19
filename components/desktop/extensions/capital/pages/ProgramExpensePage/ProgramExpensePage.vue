<template lang="pug">
q-page.program-expense-page
  //- Липкий бар с кнопкой «Назад» — канон detail-страниц (реестр документов).
  .program-expense-page__bar
    button.expense-back(type='button', @click='goBack')
      q-icon(name='arrow_back', size='18px')
      span {{ $t('capital.programExpensePage.backToExpensesLabel') }}

  //- Расход целиком показывает общий виджет шасси; странице Благороста остаётся
  //- имя инициатора из своего пула и действие совета — закрыть расход.
  .program-expense-page__content
    ExpenseProposalDetails(
      ref='details',
      :expense-hash='expenseHash',
      :creator-name='expense?.creator_name',
      :recipient-names='recipientNames'
    )
      template(#actions='{ proposal }')
        BaseButton(
          v-if='canClose(proposal.status)',
          variant='primary',
          size='sm',
          :loading='closing',
          @click='closeExpense'
        ) {{ $t('capital.programExpensePage.closeExpenseLabel') }}
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CAPITAL_LIVE_TABLES } from 'app/extensions/capital/shared/lib/live';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopStore } from 'src/entities/Desktop';
import { useMayCloseExpense } from 'src/entities/ExpenseProposal';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { ExpenseProposalDetails } from 'src/shared/ui/domain/ExpenseProposalDetails';
import { api } from 'app/extensions/capital/entities/ProgramExpense/api';
import { useProgramExpenseStore, shortExpenseId } from 'app/extensions/capital/entities/ProgramExpense/model';
import { t } from '../../i18n';

const route = useRoute();
const router = useRouter();
const system = useSystemStore();
const desktopStore = useDesktopStore();
const store = useProgramExpenseStore();

function goBack(): void {
  void router.push({ name: 'capital-program-expenses' });
}

const expenseHash = computed(() => String(route.params.expense_hash ?? ''));
const expense = computed(() => store.programExpense);
const details = ref<InstanceType<typeof ExpenseProposalDetails> | null>(null);

// Имена получателей по позициям знает проекция Благороста — шасси хранит только учётные имена.
const recipientNames = computed<Record<string, string>>(() =>
  Object.fromEntries((expense.value?.items ?? []).filter((i) => i.recipient_name).map((i) => [i.item_hash, i.recipient_name as string])),
);

async function refresh(): Promise<void> {
  try {
    await Promise.all([store.loadProgramExpense({ coopname: system.info.coopname, expense_hash: expenseHash.value }), details.value?.refresh()]);
  } catch (e) {
    FailAlert(e);
  }
}

// Заявка на расход программы живёт по ленте изменений Благороста.
useLiveReload(CAPITAL_LIVE_TABLES, () => refresh());

onMounted(() => void store.loadProgramExpense({ coopname: system.info.coopname, expense_hash: expenseHash.value }).catch(FailAlert));

// Номер СЗ — в заголовок шапки на время просмотра страницы.
watch(
  expense,
  (value) => {
    if (value) desktopStore.setPageTitleOverride(t('capital.programExpensePage.pageTitle', { expenseId: shortExpenseId(value.expense_hash) }));
  },
  { immediate: true },
);
onUnmounted(() => desktopStore.clearPageTitleOverride());

// Закрытие расхода по поданному отчёту — у председателя и кассира (право
// таблицы прав расходов); совет расход читает.
const canClose = useMayCloseExpense();

const closing = ref(false);
async function closeExpense(): Promise<void> {
  try {
    closing.value = true;
    await api.closeExpenseProposal(system.info.coopname, expenseHash.value);
    SuccessAlert(t('capital.programExpensePage.historyClosedReport'));
    await refresh();
  } catch (e) {
    FailAlert(e);
  } finally {
    closing.value = false;
  }
}
</script>

<style lang="scss" scoped>
/* Липкий бар во всю ширину — отступы несут бар и контент раздельно.
   top = высота фиксированного топбара (--p-topbar-h), иначе бар уезжает под него. */
.program-expense-page__bar {
  position: sticky;
  top: var(--p-topbar-h, 56px);
  z-index: 2;
  background: var(--p-canvas);
  border-bottom: 1px solid var(--p-line);
  padding: var(--p-3, 12px) var(--p-6, 24px);
}

.program-expense-page__content {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .program-expense-page__bar {
    padding: var(--p-3, 12px) var(--p-4, 16px);
  }
  .program-expense-page__content {
    padding: var(--p-4, 16px);
  }
}

.expense-back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.expense-back:hover {
  color: var(--p-ink);
}
</style>
