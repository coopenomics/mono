<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-economy:banner-dismissed")
    | Деньги программы: членский взнос ученика переходит в фонд кооператива, и на эти средства ведётся
    | обучение. Стоимость курса складывается снизу — часы занятий по ставке преподавателя плюс наценка,
    | одна на весь кооператив.

  PageTabs.q-mb-md(:tabs="tabs" :active-key="tab" @select="(t) => (tab = t.key)")

  template(v-if="tab === 'money'")
    .row.q-col-gutter-md
      .col-12.col-md-6(v-for="w in wallets" :key="w.id")
        WalletCard(
          :title="w.name"
          :subtitle="w.hint"
          :balance="formatAsset2Digits(w.available)"
          :symbol="symbol"
          balance-label="Остаток"
          icon="savings"
          stacked
          :loading="firstLoad"
        )

    .text-subtitle1.q-mt-lg.q-mb-sm Движение средств

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
        IdentityCell(v-if="row.username" :account-name="row.username")
        span(v-else) ______
      template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}

    EmptyState(
      v-if="!firstLoad && !movements.length"
      title="Движений пока нет"
      body="Здесь появятся взносы учеников и расходы программы, как только они пройдут."
    )
      template(#icon)
        q-icon(name="receipt_long" size="32px")

  template(v-else-if="tab === 'expenses'")
    .row.justify-end.q-mb-md
      BaseButton(variant="primary" @click="expenseOpen = true")
        template(#icon-left)
          q-icon(name="add" size="18px")
        | Подать расход

    ExpenseProposalList(
      :rows="expenseRows"
      :loading="firstLoad"
      empty-title="Расходов пока нет"
      empty-body="Расход оплачивается из фонда программы: подайте служебную записку, решение примет совет."
    )

    ExpenseCreateDialog(
      v-model="expenseOpen"
      title="Расход программы «Образование»"
      :source-wallet="EDU_EXPENSE_WALLET"
      draft-key="edu:admin-economy:create-expense:draft"
      :submit="submitExpense"
      @created="load"
    )

  template(v-else)
    .row.q-col-gutter-md
      .col-12.col-md-5
        BaseCard(title="Наценка кооператива")
          BaseForm(:loading="savingMarkup" @submit="onSaveMarkup")
            BaseInput(
              v-model="markup"
              label="Наценка, %"
              type="number"
              :hint="`Предельная скидка за годовой объём при этой наценке — ${maxDiscount}%`"
              required
            )
            template(#footer)
              .row.justify-end
                BaseButton(variant="primary" type="submit" :loading="savingMarkup") Сохранить
      .col-12.col-md-7
        BaseCard(title="Как считается взнос")
          DataRow(label="Себестоимость месяца" value="часы занятий × ставка преподавателя")
          DataRow(label="Взнос за месяц" value="себестоимость + наценка кооператива")
          DataRow(label="Взнос за год" value="месячный × 12 со скидкой за объём")
          DataRow(label="Предел скидки" :value="`${maxDiscount}% — ниже себестоимости взнос не опускается`")

    .text-subtitle1.q-mt-lg.q-mb-sm Ставки часа преподавателей

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
      template(#cell-assignments="{ row }") {{ row.assignments_active }} из {{ row.assignments_total }}
      template(#cell-actions="{ row }")
        .row.no-wrap.justify-end
          BaseButton(variant="ghost" size="sm" @click="openRate(row)") Изменить ставку

    EmptyState(
      v-if="!firstLoad && !teachers.length"
      title="Преподавателей нет"
      body="Ставка появляется здесь, когда преподаватель подпишет договор участия в хозяйственной деятельности."
    )
      template(#icon)
        q-icon(name="payments" size="32px")

  BaseDialog(v-model="rateOpen" title="Ставка часа преподавателя" size="sm")
    BaseForm(:loading="savingRate" @submit="onSaveRate")
      .t-sm.t-muted.q-mb-md(v-if="rateTarget") {{ rateTarget.display_name || rateTarget.username }}
      BaseInput(v-model="rate" label="Ставка часа" type="number" :suffix="symbol" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="rateOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="savingRate") Сохранить
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asDateInput, asText, formatToAsset } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, IdentityCell, PageHint, WalletCard } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
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

/**
 * Экономика программы. «Деньги» — где лежат средства кооператива по программе
 * и что с ними происходило: взнос ученика приходит на его членский кошелёк и
 * тем же действием уходит в фонд, из которого кооператив ведёт обучение.
 * «Настройки» — наценка кооператива и ставки часа преподавателей: из них
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
const tab = ref('money');
const expenses = ref<IExpense[]>([]);
const expenseOpen = ref(false);

const tabs: PageTab[] = [
  { key: 'money', label: 'Деньги' },
  { key: 'expenses', label: 'Расходы' },
  { key: 'settings', label: 'Настройки' },
];

const wallets = computed(() => fund.value?.wallets ?? []);
// Список расходов собирает общий виджет шасси: заголовком идёт назначение
// первой позиции — так расход узнаётся, не раскрывая карточку.
const expenseRows = computed<ExpenseProposalListRow[]>(() =>
  expenses.value.map((e) => ({
    expense_hash: asText(e.expense_hash),
    title: e.items[0]?.description || 'Расход программы',
    status: e.status,
    total_planned: e.total_planned,
    creator_name: e.creator_name,
    created_at: toIso(e.created_at),
  })),
);
const movements = computed<IFundMovement[]>(() => fund.value?.movements ?? []);

const movementColumns: BaseTableColumn<IFundMovement>[] = [
  { key: 'at', label: 'Когда', width: '150px', nowrap: true },
  { key: 'title', label: 'Что произошло' },
  { key: 'username', label: 'Пайщик', width: '220px' },
  { key: 'amount', label: 'Сумма', numeric: true, width: '150px', nowrap: true },
];

const columns: BaseTableColumn<ITeacher>[] = [
  { key: 'teacher', label: 'Преподаватель' },
  { key: 'hourly_rate', label: 'Ставка часа', numeric: true, width: '160px', nowrap: true },
  { key: 'assignments', label: 'Назначений', width: '130px', nowrap: true },
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
    maxDiscount.value = settings.max_year_discount_percent;
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
    maxDiscount.value = saved.max_year_discount_percent;
    SuccessAlert('Наценка сохранена — она действует на все курсы кооператива');
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
    SuccessAlert('Ставка сохранена');
  } catch (e) {
    FailAlert(e);
  } finally {
    savingRate.value = false;
  }
}

onMounted(load);
</script>
