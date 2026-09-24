<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-economy:banner-dismissed")
    | {{ $t('edubridge.adminEconomyPage.hint.line1') }}
    | {{ $t('edubridge.adminEconomyPage.hint.line2') }}
    | {{ $t('edubridge.adminEconomyPage.hint.line3') }}

  PageTabs.q-mb-md(:tabs="tabs" :active-key="tab" @select="(t) => (tab = t.key)")

  template(v-if="tab === 'money'")
    .row.q-col-gutter-md
      .col-12.col-md-6(v-for="w in wallets" :key="w.id")
        WalletCard(
          :title="w.name"
          :subtitle="w.summary"
          :hint="w.hint"
          :balance="splitAsset2Digits(w.available).amount"
          :symbol="splitAsset2Digits(w.available).symbol || symbol"
          :balance-label="$t('edubridge.adminEconomyPage.wallet.balanceLabel')"
          icon="savings"
          stacked
          :loading="firstLoad"
        )

    .text-subtitle1.q-mt-lg.q-mb-sm {{ $t('edubridge.adminEconomyPage.movementsTitle') }}

    BaseTable(
      v-if="loading || movements.length"
      :columns="movementColumns"
      :rows="movements"
      row-key="id"
      :loading="firstLoad"
      min-width="720px"
    )
      template(#cell-at="{ row }") {{ formatDate(row.at) }}
      template(#cell-username="{ row }")
        IdentityCell(v-if="row.username" :account-name="row.username" :full-name="row.display_name")
        span(v-else) ______
      template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}

    EmptyState(
      v-if="!firstLoad && !movements.length"
      :title="$t('edubridge.adminEconomyPage.movementsEmptyTitle')"
      :body="$t('edubridge.adminEconomyPage.movementsEmptyBody')"
    )
      template(#icon)
        q-icon(name="receipt_long" size="32px")

  //- Прекращение участия в программе по заявлению пайщика и согласованию
  //- кооператива: остаток кошелька программы уходит в паевой (п. 4.2.5 Положения ЦПП).
  template(v-else-if="tab === 'returns'")
    ReturnRequestsPanel(@decided="load")

  template(v-else-if="tab === 'expenses'")
    .row.justify-end.q-mb-md
      BaseButton(variant="primary" @click="expenseOpen = true")
        template(#icon-left)
          q-icon(name="add" size="18px")
        | {{ $t('edubridge.adminEconomyPage.submitExpense') }}

    ExpenseProposalList(
      :rows="expenseRows"
      :loading="firstLoad"
      :empty-title="$t('edubridge.adminEconomyPage.expensesEmptyTitle')"
      :empty-body="$t('edubridge.adminEconomyPage.expensesEmptyBody')"
    )

    ExpenseCreateDialog(
      v-model="expenseOpen"
      :title="$t('edubridge.adminEconomyPage.expenseDialogTitle')"
      :source-wallet="EDU_EXPENSE_WALLET"
      draft-key="edu:admin-economy:create-expense:draft"
      :submit="submitExpense"
      @created="load"
    )

  template(v-else)
    .row.q-col-gutter-md
      .col-12.col-md-5
        BaseCard(:title="$t('edubridge.adminEconomyPage.markupCardTitle')")
          BaseForm(:loading="savingMarkup" @submit="onSaveMarkup")
            BaseInput(
              v-model="markup"
              :label="$t('edubridge.adminEconomyPage.markupLabel')"
              type="number"
              required
            )
              template(#append)
                FieldHelp(:text="markupHelp")
            template(#footer)
              .row.justify-end
                BaseButton(variant="primary" type="submit" :loading="savingMarkup") {{ $t('common.action.save') }}
      .col-12.col-md-7
        BaseCard(:title="$t('edubridge.adminEconomyPage.formula.title')")
          DataRow(:label="$t('edubridge.adminEconomyPage.formula.monthCostLabel')" :value="$t('edubridge.adminEconomyPage.formula.monthCostValue')")
          DataRow(:label="$t('edubridge.adminEconomyPage.formula.monthFeeLabel')" :value="$t('edubridge.adminEconomyPage.formula.monthFeeValue')")
          DataRow(:label="$t('edubridge.adminEconomyPage.formula.durationLabel')" :value="$t('edubridge.adminEconomyPage.formula.durationValue')")
          DataRow(:label="$t('edubridge.adminEconomyPage.formula.fullCourseFeeLabel')" :value="$t('edubridge.adminEconomyPage.formula.fullCourseFeeValue')")
          DataRow(:label="$t('edubridge.adminEconomyPage.formula.maxDiscountLabel')" :value="$t(`edubridge.adminEconomyPage.formula.maxDiscountValue`, { maxDiscount })")

    .text-subtitle1.q-mt-lg.q-mb-sm {{ $t('edubridge.adminEconomyPage.teacherRatesTitle') }}

    BaseTable(
      v-if="loading || teachers.length"
      :columns="columns"
      :rows="teachers"
      row-key="username"
      :loading="firstLoad"
      min-width="620px"
    )
      template(#cell-teacher="{ row }")
        IdentityCell(:account-name="row.username" :full-name="row.display_name")
      template(#cell-hourly_rate="{ row }") {{ formatAsset2Digits(row.hourly_rate) }}
      template(#cell-assignments="{ row }") {{ $t('edubridge.adminEconomyPage.assignmentsCount', { active: row.assignments_active, total: row.assignments_total }) }}
      template(#cell-actions="{ row }")
        .row.no-wrap.justify-end
          BaseButton(variant="ghost" size="sm" @click="openRate(row)") {{ $t('edubridge.adminEconomyPage.editRate') }}

    EmptyState(
      v-if="!firstLoad && !teachers.length"
      :title="$t('edubridge.adminEconomyPage.teachersEmptyTitle')"
      :body="$t('edubridge.adminEconomyPage.teachersEmptyBody')"
    )
      template(#icon)
        q-icon(name="payments" size="32px")

  BaseDialog(v-model="rateOpen" :title="$t('edubridge.adminEconomyPage.rateDialog.title')" size="sm")
    BaseForm(:loading="savingRate" @submit="onSaveRate")
      .t-sm.t-muted.q-mb-md(v-if="rateTarget") {{ rateTarget.display_name || rateTarget.username }}
      BaseInput(v-model="rate" :label="$t('edubridge.adminEconomyPage.rateDialog.rateLabel')" type="number" :suffix="symbol" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="rateOpen = false") {{ $t('edubridge.adminEconomyPage.rateDialog.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="savingRate") {{ $t('common.action.save') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asDateInput, asText, formatToAsset } from 'src/shared/lib/utils';
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState, FieldHelp, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, IdentityCell, PageHint, WalletCard } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { ReturnRequestsPanel } from '../../features/ReturnToShare';
import { ExpenseCreateDialog, ExpenseProposalList, type ExpenseCreatePayload, type ExpenseProposalListRow } from 'src/shared/ui/domain';
import {
  EDU_EXPENSE_WALLET,
  createExpense,
  fetchEconomySettings,
  fetchExpenses,
  fetchProgramFund,
  setEconomySettings,
  setTeacherRate,
  type IExpense,
  type IFundMovement,
  type IProgramFund,
} from '../../entities/Economy';
import { fetchTeachers, type ITeacher } from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t as i18nT } from '../../i18n';

/**
 * Экономика программы. «Деньги» — где лежат средства кооператива по программе
 * и что с ними происходило: взнос ученика приходит на его членский кошелёк и
 * тем же действием уходит в фонд, из которого кооператив ведёт обучение.
 * «Настройки» — целевой членский взнос кооператива и ставки часа преподавателей: из них
 * складывается взнос за курс, поэтому они живут рядом.
 */
const system = useSystemStore();
const symbol = computed(() => system.governSymbol);

const fund = ref<IProgramFund | null>(null);
const teachers = ref<ITeacher[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const markup = ref('0');
const maxDiscount = ref(0);
const savingMarkup = ref(false);
const rateOpen = ref(false);
const rateTarget = ref<ITeacher | null>(null);
const rate = ref('');
const savingRate = ref(false);
const expenses = ref<IExpense[]>([]);
const expenseOpen = ref(false);

const tabs: PageTab[] = [
  { key: 'money', label: i18nT('edubridge.adminEconomyPage.tab.money') },
  { key: 'expenses', label: i18nT('edubridge.adminEconomyPage.tab.expenses') },
  { key: 'returns', label: i18nT('edubridge.adminEconomyPage.tab.returns') },
  { key: 'settings', label: i18nT('edubridge.adminEconomyPage.tab.settings') },
];
// Вкладку можно открыть ссылкой (?tab=settings) — так конструктор курса ведёт
// к правке целевого членского взноса.
const route = useRoute();
const requestedTab = String(route.query.tab ?? '');
const tab = ref(tabs.some((t) => t.key === requestedTab) ? requestedTab : 'money');
const markupHelp = computed(
  () =>
    i18nT('edubridge.adminEconomyPage.markupHelp', { maxDiscount: maxDiscount.value }),
);

const wallets = computed(() => fund.value?.wallets ?? []);
// Список расходов собирает общий виджет шасси: заголовком идёт назначение
// первой позиции — так расход узнаётся, не раскрывая карточку.
const expenseRows = computed<ExpenseProposalListRow[]>(() =>
  expenses.value.map((e) => ({
    expense_hash: asText(e.expense_hash),
    title: e.items[0]?.description || i18nT('edubridge.adminEconomyPage.expenseFallbackTitle'),
    status: e.status,
    total_planned: e.total_planned,
    creator_name: e.creator_name,
    created_at: toIso(e.created_at),
  })),
);
const movements = computed<IFundMovement[]>(() => fund.value?.movements ?? []);

const movementColumns: BaseTableColumn<IFundMovement>[] = [
  { key: 'at', label: i18nT('edubridge.adminEconomyPage.column.at'), width: '150px', nowrap: true },
  { key: 'title', label: i18nT('edubridge.adminEconomyPage.column.title') },
  { key: 'username', label: i18nT('edubridge.adminEconomyPage.column.username'), width: '220px' },
  { key: 'amount', label: i18nT('edubridge.adminEconomyPage.column.amount'), numeric: true, width: '150px', nowrap: true },
];

const columns: BaseTableColumn<ITeacher>[] = [
  { key: 'teacher', label: i18nT('edubridge.adminEconomyPage.column.teacher') },
  { key: 'hourly_rate', label: i18nT('edubridge.adminEconomyPage.column.hourlyRate'), numeric: true, width: '160px', nowrap: true },
  { key: 'assignments', label: i18nT('edubridge.adminEconomyPage.column.assignments'), width: '130px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '180px' },
];

/** Список шасси ждёт дату строкой — приводим к ней раз и навсегда. */
const toIso = (v: unknown): string | undefined => {
  const input = asDateInput(v);
  return input ? new Date(input).toISOString() : undefined;
};

const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '______';
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [settings, list, money, spending] = await Promise.all([
      fetchEconomySettings(),
      fetchTeachers(),
      fetchProgramFund(),
      fetchExpenses({ page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'DESC' }),
    ]);
    markup.value = String(settings.markup_percent);
    maxDiscount.value = settings.max_course_discount_percent;
    teachers.value = list;
    fund.value = money;
    expenses.value = spending.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onSaveMarkup(): Promise<void> {
  savingMarkup.value = true;
  try {
    const saved = await setEconomySettings({ markup_percent: Number(markup.value) });
    maxDiscount.value = saved.max_course_discount_percent;
    SuccessAlert(i18nT('edubridge.adminEconomyPage.markupSaved'));
  } catch (e) {
    FailAlert(e);
  } finally {
    savingMarkup.value = false;
  }
}

/**
 * Подача расхода: форму, документ и подпись собирает общий виджет шасси,
 * расширению остаётся мутация — она выделяет средства фонда под расход и
 * передаёт записку в шасси.
 */
async function submitExpense(payload: ExpenseCreatePayload): Promise<unknown> {
  return createExpense({
    expense_hash: payload.expense_hash,
    items: payload.items,
    statement: payload.statement,
  } as never);
}

function openRate(row: ITeacher): void {
  rateTarget.value = row;
  rate.value = String(parseFloat(row.hourly_rate) || '');
  rateOpen.value = true;
}

async function onSaveRate(): Promise<void> {
  if (!rateTarget.value) return;
  savingRate.value = true;
  try {
    const hourly_rate = formatToAsset(String(rate.value).replace(',', '.'), symbol.value);
    await setTeacherRate({ username: rateTarget.value.username, hourly_rate });
    teachers.value = teachers.value.map((t) => (t.username === rateTarget.value?.username ? { ...t, hourly_rate } : t));
    rateOpen.value = false;
    SuccessAlert(i18nT('edubridge.adminEconomyPage.rateSaved'));
  } catch (e) {
    FailAlert(e);
  } finally {
    savingRate.value = false;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.teacherContracts, EduLive.contributions, EduLive.userWallets], load);

onMounted(load);
</script>
