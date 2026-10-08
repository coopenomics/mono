<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-economy:banner-dismissed")
    | {{ $t('edubridge.adminEconomyPage.hint.line1') }}

  PageTabs.q-mb-md(:tabs="tabs" :active-key="tab" @select="(t) => (tab = t.key)")
    //- Действие вкладки живёт в её полосе, а не плавает над списком.
    template(v-if="tab === 'expenses'" #actions)
      BaseButton(variant="primary" size="sm" @click="expenseOpen = true")
        template(#icon-left)
          q-icon(name="add" size="18px")
        | {{ $t('edubridge.adminEconomyPage.submitExpense') }}

  template(v-if="tab === 'money'")
    //- Четыре остатка — одной полосой по пути денег: кошельки учеников →
    //- удержано по гарантии → фонд → резерв преподавателям. У каждого свой значок.
    //- Схема пути взноса — по ссылке над плитками, сами плитки стоят в том же порядке.
    .row.justify-end.q-mb-sm
      MoneyFlowGuide
    StatStrip(:items="walletStats" :loading="firstLoad")

    //- Таблица стоит на месте, пока идёт первая загрузка либо есть строки:
    //- фоновое обновление по ленте изменений её не прячет и не показывает заново.
    //- Строка открывает движение в правой панели.
    BaseTable.q-mt-lg(
      v-if="firstLoad || movements.length"
      :columns="movementColumns"
      :rows="movements"
      row-key="id"
      :loading="firstLoad"
      :clickable-rows="true"
      min-width="720px"
      @row-click="openMovement"
    )
      template(#cell-at="{ row }") {{ formatDate(row.at) }}
      template(#cell-title="{ row }")
        .edu-economy__move
          q-icon.edu-economy__dir(:name="row.direction === 'in' ? 'south_west' : 'north_east'" :class="row.direction === 'in' ? 'edu-economy__dir--in' : 'edu-economy__dir--out'" size="16px")
          span {{ row.title }}
      template(#cell-username="{ row }")
        IdentityCell(v-if="row.username" :account-name="row.username" :full-name="row.display_name")
        span(v-else) ______
      template(#cell-amount="{ row }")
        span.t-num {{ formatAsset2Digits(row.amount) }}

    EmptyState.q-mt-lg(
      v-if="!firstLoad && !movements.length"
      :title="$t('edubridge.adminEconomyPage.movementsEmptyTitle')"
      :body="$t('edubridge.adminEconomyPage.movementsEmptyBody')"
    )
      template(#icon)
        q-icon(name="receipt_long" size="32px")

    //- Движение целиком: сумма крупно, затем когда, куда и от кого.
    DetailsDrawer(v-model="movementOpen" :title="movement?.title || ''" :width="480")
      template(v-if="movement")
        .edu-economy__amount
          .t-eyebrow {{ $t('edubridge.adminEconomyPage.column.amount') }}
          FeeAmount(:value="movement.amount" size="lg")
        DataRow(:label="$t('edubridge.adminEconomyPage.column.at')" :value="formatDate(movement.at)")
        DataRow(:label="$t('edubridge.adminEconomyPage.movement.directionLabel')" :value="movement.direction === 'in' ? $t('edubridge.adminEconomyPage.movement.in') : $t('edubridge.adminEconomyPage.movement.out')")
        DataRow(:label="$t('edubridge.adminEconomyPage.column.username')")
          template(#value-override)
            IdentityCell(v-if="movement.username" :account-name="movement.username" :full-name="movement.display_name" copyable)
            span(v-else) ______
        DataRow(:label="$t('edubridge.adminEconomyPage.movement.idLabel')" :value="asText(movement.id)" mono copyable)

  template(v-else-if="tab === 'expenses'")
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
        //- Что это за взнос и на что он влияет — коротко, рядом с полем.
        BaseCard(:title="$t('edubridge.adminEconomyPage.markupAbout.title')")
          .t-sm.t-muted {{ $t('edubridge.adminEconomyPage.markupAbout.purpose') }}
          DataRow.q-mt-md(:label="$t('edubridge.adminEconomyPage.markupAbout.scopeLabel')" :value="$t('edubridge.adminEconomyPage.markupAbout.scopeValue')" align="spread")
          DataRow(:label="$t('edubridge.adminEconomyPage.markupAbout.maxDiscountLabel')" :value="`${maxDiscount}%`" align="spread")
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseForm, BaseInput, BaseTable, EmptyState, FieldHelp, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { MoneyFlowGuide } from '../../widgets/MoneyFlowGuide';
import { PROGRAM_WALLET_ICONS, PROGRAM_WALLET_ORDER, type ProgramWalletId } from '../../shared/lib/programWallets';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { StatStrip, type StatStripItem } from '../../shared/ui/StatStrip';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { ExpenseCreateDialog, ExpenseProposalList, type ExpenseCreatePayload, type ExpenseProposalListRow } from 'src/shared/ui/domain';
import {
  EDU_EXPENSE_WALLET,
  createExpense,
  fetchEconomySettings,
  fetchExpenses,
  fetchProgramFund,
  setEconomySettings,
  type IExpense,
  type IFundMovement,
  type IProgramFund,
} from '../../entities/Economy';
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
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const markup = ref('0');
const maxDiscount = ref(0);
const savingMarkup = ref(false);
const expenses = ref<IExpense[]>([]);
const expenseOpen = ref(false);

const tabs: PageTab[] = [
  { key: 'money', label: i18nT('edubridge.adminEconomyPage.tab.money') },
  { key: 'expenses', label: i18nT('edubridge.adminEconomyPage.tab.expenses') },
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

/**
 * Как показывать каждый кошелёк программы: значок, оттенок и место в полосе.
 * Порядок — путь денег: взнос ученика лежит на его кошельке, удерживается до
 * конца гарантии, освобождается в фонд, из фонда уходит в резерв преподавателям.
 * Имя сервера длинное и формальное — в полосе короткая подпись, полное имя в подсказке.
 */
const WALLET_CAPTIONS: Record<ProgramWalletId, string> = {
  'w.edu.member': i18nT('edubridge.adminEconomyPage.walletShort.members'),
  'w.edu.escrow': i18nT('edubridge.adminEconomyPage.walletShort.escrow'),
  'w.edu.fund': i18nT('edubridge.adminEconomyPage.walletShort.fund'),
  'w.edu.teach': i18nT('edubridge.adminEconomyPage.walletShort.reserve'),
};
const WALLET_VIEW: Record<string, { icon: string; order: number; caption: string }> = Object.fromEntries(
  PROGRAM_WALLET_ORDER.map((id, order) => [id, { icon: PROGRAM_WALLET_ICONS[id], order, caption: WALLET_CAPTIONS[id] }]),
);
const walletStats = computed<StatStripItem[]>(() =>
  [...(fund.value?.wallets ?? [])]
    .sort((a, b) => (WALLET_VIEW[a.id]?.order ?? 9) - (WALLET_VIEW[b.id]?.order ?? 9))
    .map((w) => {
      const view = WALLET_VIEW[w.id];
      const money = splitAsset2Digits(w.available);
      return {
        key: w.id,
        icon: view?.icon ?? 'savings',
        caption: view?.caption ?? w.name,
        value: money.amount,
        symbol: money.symbol || symbol.value,
        sub: w.summary,
        hint: `${w.name}. ${w.hint}`,
      };
    }),
);

/** Движение в правой панели. */
const movementOpen = ref(false);
const movement = ref<IFundMovement | null>(null);
function openMovement(row: IFundMovement): void {
  movement.value = row;
  movementOpen.value = true;
}
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
    const [settings, money, spending] = await Promise.all([
      fetchEconomySettings(),
      fetchProgramFund(),
      fetchExpenses({ page: 1, limit: 50, sortBy: 'createdAt', sortOrder: 'DESC' }),
    ]);
    markup.value = String(settings.markup_percent);
    maxDiscount.value = settings.max_course_discount_percent;
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

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.teacherContracts, EduLive.contributions, EduLive.userWallets], load);

onMounted(load);
</script>

<style scoped>
.edu-economy__move {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
}
/* Направление движения — значком у названия: в фонд или из фонда. */
.edu-economy__dir {
  flex: none;
}
.edu-economy__dir--in {
  color: var(--p-pos);
}
.edu-economy__dir--out {
  color: var(--p-ink-3);
}
.edu-economy__amount {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-bottom: var(--p-4);
  margin-bottom: var(--p-2);
  border-bottom: 1px solid var(--p-line);
}
</style>
