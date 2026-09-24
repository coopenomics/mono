<template lang="pug">
div
  //- Пачкой одобряют, когда ждут несколько запросов: отметил нужные — одно
  //- подтверждение на всю пачку вместо десяти одинаковых нажатий.
  .row.items-center.justify-between.q-mb-md(v-if="selectedPending.length")
    .t-sm.t-muted {{ $t('chairman.approvalsTableWidget.selectedCount', { count: selectedPending.length }) }}
    .row.q-gutter-sm
      BaseButton(variant="secondary" size="sm" :loading="bulkBusy" @click="askBulk('approve')") {{ $t('chairman.approvalsTableWidget.approveSelected') }}
      BaseButton(variant="ghost" size="sm" :loading="bulkBusy" @click="askBulk('decline')") {{ $t('chairman.approvalsTableWidget.declineSelected') }}

  BaseTable(
    :columns="columns"
    :rows="approvals"
    row-key="approval_hash"
    :loading="loading"
    selection="multiple"
    v-model:selected="selected"
    clickable-rows
    min-width="820px"
    @row-click="openDetails"
  )
    template(#cell-username="{ row }")
      IdentityCell(:account-name="row.username" :full-name="fioCache.get(row.username) || null")
    template(#cell-action="{ row }") {{ actionLabel(row) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(v-if="pagination && pagination.rowsNumber > pagination.rowsPerPage" #footer)
      TablePager(
        :label="$t('chairman.approvalsTableWidget.pagerLabel')"
        :page="pagination.page"
        :rows-per-page="pagination.rowsPerPage"
        :rows-number="pagination.rowsNumber"
        @update:page="(page) => emit('update:page', page)"
      )

  EmptyState(v-if="!loading && !approvals.length" :title="$t('chairman.approvalsTableWidget.emptyTitle')" :body="$t('chairman.approvalsTableWidget.emptyBody')")
    template(#icon)
      q-icon(name="inbox" size="32px")

  //- Подробности — справа, как у вопроса повестки: документы свёрнуты, решение
  //- принимается не закрывая панель.
  DetailsDrawer(v-model="detailsOpen" :title="detailsTitle" :width="720")
    template(v-if="current")
      DataRow(:label="$t('chairman.approvalsTableWidget.column.member')" :value="fioCache.get(current.username) || current.username")
      DataRow(:label="$t('chairman.approvalsTableWidget.column.username')" :value="current.username" mono copyable)
      DataRow(:label="$t('chairman.approvalsTableWidget.column.action')" :value="actionLabel(current)")
      DataRow(:label="$t('chairman.approvalsTableWidget.column.created')" :value="formatDate(current.created_at)")
      DataRow(:label="$t('chairman.approvalsTableWidget.column.state')")
        template(#value-override)
          BaseBadge(:variant="statusOf(current.status).variant") {{ statusOf(current.status).label }}
      ComplexDocument.q-mt-md(v-if="current.document" :document="current.document" collapsible)
    template(#footer)
      .row.justify-end.q-gutter-sm(v-if="current && current.status === 'PENDING'")
        BaseButton(variant="ghost" :loading="singleBusy" @click="askSingle('decline')" v-if="declinable(current)") {{ $t('chairman.declineApprovalButton.declineLabel') }}
        BaseButton(variant="primary" :loading="singleBusy" @click="askSingle('approve')") {{ $t('chairman.confirmApprovalButton.approveLabel') }}

  BaseDialog(v-model="confirmOpen" :title="confirmTitle" size="sm")
    p {{ confirmText }}
    //- Причину отказа видит тот, кому отказали: она приходит к нему в стол.
    BaseInput.q-mt-sm(
      v-if="confirmKind === 'decline'"
      v-model="declineReason"
      :label="$t('chairman.approvalsTableWidget.declineReasonLabel')"
      type="textarea"
      :rows="2"
      required
    )
    template(#footer)
      BaseButton(variant="ghost" :disabled="bulkBusy || singleBusy" @click="confirmOpen = false") {{ $t('chairman.confirmApprovalButton.cancelLabel') }}
      BaseButton(
        :variant="confirmKind === 'approve' ? 'primary' : 'secondary'"
        :disabled="confirmKind === 'decline' && !declineReason.trim()"
        :loading="bulkBusy || singleBusy"
        @click="runConfirmed"
      ) {{ confirmKind === 'approve' ? $t('chairman.confirmApprovalButton.approveLabel') : $t('chairman.declineApprovalButton.declineLabel') }}
</template>

<script lang="ts" setup>
import { computed, ref, watch, type Ref } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import type { IApproval } from 'app/extensions/chairman/entities/Approval/model/types';

/** Элемент реестра: в выдаче SDK тип допускает пустоту, в списке её нет. */
type Approval = NonNullable<IApproval>;
import { useConfirmApproval } from 'app/extensions/chairman/features/Approval/ConfirmApproval';
import { useDeclineApproval } from 'app/extensions/chairman/features/Approval/DeclineApproval';
import { get_approval_action_label, is_approval_declinable } from 'app/extensions/chairman/shared';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { BaseBadge, BaseButton, BaseDialog, BaseInput, BaseTable, EmptyState, TablePager, type BaseTableColumn } from 'src/shared/ui/base';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { DataRow, DetailsDrawer, IdentityCell } from 'src/shared/ui/domain';
import { t } from '../../../i18n';

/**
 * Запросы предварительных одобрений председателя. Пайщик показан человеческим
 * именем (учётное имя рядом, с копированием), подробности и документы уходят в
 * правую панель, а одинаковые решения принимаются пачкой по отметкам.
 */
interface Props {
  approvals: Approval[];
  loading?: boolean;
  /** Страницы считает сервер — экран отдаёт номер и общее число. */
  pagination?: { page: number; rowsPerPage: number; rowsNumber: number };
}

const props = withDefaults(defineProps<Props>(), { approvals: () => [], loading: false });
const emit = defineEmits<{ 'update:page': [page: number] }>();

const STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'warn' | 'neg' | 'neutral' }> = {
  PENDING: { label: t('chairman.approval.status.pending'), variant: 'warn' },
  APPROVED: { label: t('chairman.approval.status.approved'), variant: 'pos' },
  DECLINED: { label: t('chairman.approval.status.declined'), variant: 'neg' },
};

const columns: BaseTableColumn<Approval>[] = [
  { key: 'username', label: t('chairman.approvalsTableWidget.column.member'), width: '260px' },
  { key: 'action', label: t('chairman.approvalsTableWidget.column.action') },
  { key: 'status', label: t('chairman.approvalsTableWidget.column.state'), width: '140px', nowrap: true },
  { key: 'created_at', label: t('chairman.approvalsTableWidget.column.created'), width: '130px', nowrap: true },
];

const { fioCache, enrichFio } = useFioCache();
const { confirmApproval } = useConfirmApproval();
const { declineApproval } = useDeclineApproval();

const selected = ref<Approval[]>([]);
const detailsOpen = ref(false);
const current = ref<Approval | null>(null);
const confirmOpen = ref(false);
const confirmKind = ref<'approve' | 'decline'>('approve');
const confirmScope = ref<'single' | 'bulk'>('single');
const declineReason = ref('');
const bulkBusy = ref(false);
const singleBusy = ref(false);

const selectedPending = computed(() => selected.value.filter((a) => a.status === 'PENDING'));
const detailsTitle = computed(() => (current.value ? actionLabel(current.value) : t('chairman.approvalsTableWidget.detailsDefaultTitle')));
const confirmTitle = computed(() => (confirmKind.value === 'approve' ? t('chairman.confirmApprovalButton.title') : t('chairman.approvalsTableWidget.declineConfirmTitle')));
const confirmText = computed(() => {
  const n = confirmScope.value === 'bulk' ? selectedPending.value.length : 1;
  if (confirmKind.value === 'approve') {
    return n === 1 ? t('chairman.approvalsTableWidget.approveConfirmOne') : t('chairman.approvalsTableWidget.approveConfirm', n);
  }
  return n === 1 ? t('chairman.approvalsTableWidget.declineConfirmOne') : t('chairman.approvalsTableWidget.declineConfirm', n);
});

const statusOf = (s: string) => STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const actionLabel = (a: Approval) => get_approval_action_label(a.callback_contract, a.callback_action_approve);
const declinable = (a: Approval) => is_approval_declinable(a.callback_contract, a.callback_action_approve);
// Дата приходит из SDK и строкой, и объектом, а тип у неё в схеме неизвестный.
const formatDate = (date: unknown) => {
  if (date instanceof Date) return date.toLocaleDateString(uiLocale());
  return typeof date === 'string' ? new Date(date).toLocaleDateString(uiLocale()) : '______';
};

function openDetails(row: Approval): void {
  current.value = row;
  detailsOpen.value = true;
}

function askSingle(kind: 'approve' | 'decline'): void {
  declineReason.value = '';
  confirmKind.value = kind;
  confirmScope.value = 'single';
  confirmOpen.value = true;
}

function askBulk(kind: 'approve' | 'decline'): void {
  declineReason.value = '';
  confirmKind.value = kind;
  confirmScope.value = 'bulk';
  confirmOpen.value = true;
}

/** Одно решение по одному запросу: одобрение подписывает документ второй подписью. */
async function decide(a: Approval, kind: 'approve' | 'decline'): Promise<void> {
  if (kind === 'approve') {
    await confirmApproval(a.coopname, a.approval_hash, a.document);
  } else {
    await declineApproval({ coopname: a.coopname, approval_hash: a.approval_hash.toLowerCase(), reason: declineReason.value.trim() });
  }
}

/** Что решаем и по каким запросам — берётся из того, как открыли подтверждение. */
function pendingScope(): { items: Approval[]; busy: Ref<boolean> } {
  if (confirmScope.value === 'bulk') return { items: [...selectedPending.value], busy: bulkBusy };
  return { items: current.value ? [current.value] : [], busy: singleBusy };
}

/** Итог пачки одним сообщением: сколько решений прошло. */
function reportDone(kind: 'approve' | 'decline', done: number): void {
  if (done) SuccessAlert(kind === 'approve' ? t('chairman.approvalsTableWidget.approvedCount', { count: done }) : t('chairman.approvalsTableWidget.declinedCount', { count: done }));
}

async function runConfirmed(): Promise<void> {
  const kind = confirmKind.value;
  const { items, busy } = pendingScope();
  if (!items.length) return;
  busy.value = true;
  let done = 0;
  try {
    // Каждый запрос решается отдельной транзакцией: пачка — сокращение нажатий,
    // а не одна операция в цепи. Первый отказ останавливает цикл, уже принятые
    // решения остаются в силе.
    for (const a of items) {
      await decide(a, kind);
      done += 1;
    }
    reportDone(kind, done);
    selected.value = [];
    confirmOpen.value = false;
    if (confirmScope.value === 'single') detailsOpen.value = false;
  } catch (e) {
    reportDone(kind, done);
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

watch(
  () => props.approvals,
  (list) => {
    void enrichFio((list ?? []).map((a) => a.username));
  },
  { immediate: true },
);
</script>
