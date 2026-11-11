<template lang="pug">
//- Реестр контрагентов кооператива на столе совета (задача 99D-35):
//- организации и ИП, которым кооператив платит по реквизитам. Совет видит,
//- добавляет, правит, убирает в архив и удаляет всех контрагентов, включая
//- добавленных участками. Строка открывает правую панель с реквизитами.
q-page.counterparties
  .counterparties__toolbar
    BaseInput.counterparties__search(
      v-model='search',
      type='search',
      :placeholder='$t("expenses.counterpartiesPage.searchPlaceholder")',
      clearable
    )
      template(#prepend)
        q-icon(name='search', size='18px')
    q-toggle(v-model='includeArchived', :label='$t("expenses.counterpartiesPage.showArchived")', dense)

  BaseTable(
    v-if='firstLoad || items.length',
    :columns='columns',
    :rows='items',
    row-key='id',
    :loading='firstLoad',
    :skeleton-rows='6',
    min-width='760px',
    clickable-rows,
    @row-click='openDrawer'
  )
    template(#cell-name='{ row }')
      .counterparties__name {{ row.name }}
      .counterparties__meta.t-mono-sm {{ row.tax_id }}
    template(#cell-kind='{ row }')
      | {{ kindLabel(row.kind) }}
    template(#cell-scope='{ row }')
      | {{ scopeLabel(row.braname) }}
    template(#cell-state='{ row }')
      BaseBadge(:variant='row.archived ? "neutral" : "pos"')
        | {{ row.archived ? $t('expenses.counterpartiesPage.stateArchived') : $t('expenses.counterpartiesPage.stateActive') }}

  EmptyState(
    v-else,
    :title='search || includeArchived ? $t("expenses.counterpartiesPage.notFoundTitle") : $t("expenses.counterpartiesPage.emptyTitle")',
    :body='search || includeArchived ? $t("expenses.counterpartiesPage.notFoundBody") : $t("expenses.counterpartiesPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='business', size='48px')

  DetailsDrawer(
    v-model='drawerOpen',
    :title='current?.name ?? ""',
    :width='480'
  )
    template(v-if='current')
      .counterparty-card
        .counterparty-card__head
          BaseBadge(:variant='current.archived ? "neutral" : "pos"')
            | {{ current.archived ? $t('expenses.counterpartiesPage.stateArchived') : $t('expenses.counterpartiesPage.stateActive') }}
          span.counterparty-card__meta {{ kindLabel(current.kind) }} · {{ scopeLabel(current.braname) }}

        section.counterparty-card__section
          h3.counterparty-card__label {{ $t('expenses.counterpartiesPage.requisitesTitle') }}
          DataRow(
            v-for='r in current.requisites',
            :key='r.key',
            :label='r.label',
            :value='r.value',
            align='spread',
            mono,
            copyable
          )

        section.counterparty-card__section(v-if='current.payment_purpose')
          h3.counterparty-card__label {{ $t('expenses.counterpartiesPage.purposeLabel') }}
          p.counterparty-card__text {{ current.payment_purpose }}

        section.counterparty-card__section
          DataRow(:label='$t("expenses.counterpartiesPage.createdLabel")', :value='formatDate(current.created_at)', align='spread')
          DataRow(:label='$t("expenses.counterpartiesPage.creatorLabel")', :value='current.creator', align='spread')

    template(v-if='current?.can_manage' #footer)
      .counterparty-card__actions
        BaseButton(variant='secondary', size='sm', :disabled='acting', @click='editOpen = true')
          template(#icon-left)
            q-icon(name='edit', size='16px')
          | {{ $t('expenses.counterpartiesPage.editAction') }}
        BaseButton(variant='secondary', size='sm', :loading='acting', @click='onToggleArchive')
          | {{ current.archived ? $t('expenses.counterpartiesPage.restoreAction') : $t('expenses.counterpartiesPage.archiveAction') }}
        BaseButton(variant='danger', size='sm', :disabled='acting', @click='onDelete')
          | {{ $t('expenses.counterpartiesPage.deleteAction') }}

  ExpenseCounterpartyFormDialog(v-model='addOpen', :braname='null', @saved='load')
  ExpenseCounterpartyFormDialog(v-model='editOpen', :counterparty='current', @saved='onEdited')
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { uiLocale } from 'src/shared/i18n';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseBadge, BaseButton, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, ExpenseCounterpartyFormDialog } from 'src/shared/ui/domain';
import {
  archiveExpenseCounterparty,
  deleteExpenseCounterparty,
  listExpenseCounterparties,
  type ExpenseCounterpartyView,
} from 'src/shared/lib/expenses/counterparties';
import AddCounterpartyButton from './AddCounterpartyButton.vue';
import { t } from '../i18n';

const { registerAction } = useHeaderActions();
const { confirm } = useConfirm();

const items = ref<ExpenseCounterpartyView[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const search = ref('');
const includeArchived = ref(false);
const drawerOpen = ref(false);
const currentId = ref<number | null>(null);
const addOpen = ref(false);
const editOpen = ref(false);
const acting = ref(false);

const current = computed(() => items.value.find((c) => c.id === currentId.value) ?? null);

const columns: BaseTableColumn<ExpenseCounterpartyView>[] = [
  { key: 'name', label: t('expenses.counterpartiesPage.columnName'), width: '320px', field: 'name', sortable: true },
  { key: 'kind', label: t('expenses.counterpartiesPage.columnKind'), width: '110px', nowrap: true },
  { key: 'scope', label: t('expenses.counterpartiesPage.columnBranch'), width: '170px', nowrap: true },
  { key: 'state', label: t('expenses.counterpartiesPage.columnState'), width: '140px', nowrap: true },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listExpenseCounterparties({
      search: search.value.trim() || undefined,
      include_archived: includeArchived.value,
    });
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  // timing: debounce — запрос поиска после паузы набора, а не на каждую букву.
  searchTimer = setTimeout(() => void load(), 300);
});
watch(includeArchived, () => void load());

useLiveReload([{ code: 'expenses', table: 'expense_counterparties' }], load);

function kindLabel(kind: Zeus.ExpenseCounterpartyKind): string {
  return kind === Zeus.ExpenseCounterpartyKind.ENTREPRENEUR
    ? t('expenses.counterpartiesPage.kindEntrepreneur')
    : t('expenses.counterpartiesPage.kindLegal');
}

function scopeLabel(braname: string | null | undefined): string {
  return braname ? t('expenses.counterpartiesPage.branchScope', { branch: braname }) : t('expenses.counterpartiesPage.coopScope');
}

function formatDate(value: unknown): string {
  return value ? new Date(String(value)).toLocaleDateString(uiLocale()) : '—';
}

function openDrawer(row: ExpenseCounterpartyView): void {
  currentId.value = row.id;
  drawerOpen.value = true;
}

function onEdited(cp: ExpenseCounterpartyView): void {
  items.value = items.value.map((c) => (c.id === cp.id ? cp : c));
}

async function onToggleArchive(): Promise<void> {
  const cp = current.value;
  if (!cp) return;
  acting.value = true;
  try {
    await archiveExpenseCounterparty({ id: cp.id, archived: !cp.archived });
    SuccessAlert(cp.archived ? t('expenses.counterpartiesPage.restoredMessage') : t('expenses.counterpartiesPage.archivedMessage'));
    if (!cp.archived && !includeArchived.value) drawerOpen.value = false;
    await load();
  } catch (e) {
    FailAlert(e, t('expenses.counterpartiesPage.actionFailed'));
  } finally {
    acting.value = false;
  }
}

async function onDelete(): Promise<void> {
  const cp = current.value;
  if (!cp) return;
  const ok = await confirm({
    title: t('expenses.counterpartiesPage.deleteConfirmTitle'),
    message: t('expenses.counterpartiesPage.deleteConfirmMessage', { name: cp.name }),
    note: t('expenses.counterpartiesPage.deleteConfirmNote'),
    confirmLabel: t('expenses.counterpartiesPage.deleteAction'),
    danger: true,
  });
  if (!ok) return;
  acting.value = true;
  try {
    await deleteExpenseCounterparty({ id: cp.id });
    SuccessAlert(t('expenses.counterpartiesPage.deletedMessage'));
    drawerOpen.value = false;
    await load();
  } catch (e) {
    FailAlert(e, t('expenses.counterpartiesPage.actionFailed'));
  } finally {
    acting.value = false;
  }
}

onMounted(() => {
  registerAction({
    id: 'expenses-counterparties-add',
    component: AddCounterpartyButton,
    props: { onClick: () => (addOpen.value = true) },
    order: 1,
  });
  void load();
});
</script>

<style lang="scss" scoped>
.counterparties {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.counterparties__toolbar {
  display: flex;
  align-items: center;
  gap: var(--p-4);
  flex-wrap: wrap;
}

.counterparties__search {
  flex: 1 1 320px;
  max-width: 420px;
}

.counterparties__name {
  font-weight: 600;
  color: var(--p-ink);
}

.counterparties__meta {
  color: var(--p-ink-3);
}

.counterparty-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}

.counterparty-card__head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.counterparty-card__meta {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.counterparty-card__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.counterparty-card__label {
  margin: 0 0 var(--p-1);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);
}

.counterparty-card__text {
  margin: 0;
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
  color: var(--p-ink);
  white-space: pre-line;
}

.counterparty-card__actions {
  display: flex;
  gap: var(--p-2);
  flex-wrap: wrap;
}
</style>
