<template lang="pug">
//- Расход шасси целиком — общий виджет для любого пула (Благорост, программа
//- «Образование», стол кассира): состояние, сводка, документы, позиции с
//- реквизитами и файлами, история. Данные виджет берёт у шасси сам по хэшу;
//- пул подаёт только то, чего шасси не знает, — имя инициатора и получателей.
.expense-details
  .expense-details__skel(v-if='loading && !proposal')
    q-skeleton(type='rect', height='96px')
    q-skeleton(type='rect', height='180px')

  template(v-else-if='proposal')
    //- Состояние заявки — вверху; справа — действие пула (закрыть расход и т.п.).
    .expense-details__head
      BaseChip(:variant='proposalStatusVariant(proposal.status)') {{ proposalStatusLabel(proposal.status) }}
      slot(name='actions', :proposal='proposal')

    BaseCard
      .expense-details__summary
        DataRow(:label='$t("ui.expenseProposalDetails.memoNumberLabel")', :value='shortExpenseId(proposal.proposal_hash)', mono, copyable)
        DataRow(:label='$t("ui.expenseProposalDetails.initiatorLabel")', :value='creatorName || proposal.username')
        DataRow(:label='$t("ui.expenseProposalDetails.createdLabel")', :value='formatDate(proposal.created_at)')
        DataRow(:label='$t("ui.expenseProposalDetails.plannedAmountLabel")', :value='formatAsset2Digits(proposal.total_planned)')
        DataRow(v-if='hasAmount(proposal.total_actual)', :label='$t("ui.expenseProposalDetails.actualSpentLabel")', :value='formatAsset2Digits(proposal.total_actual)')

    //- Документы расхода — заявление (СЗ) и протокол решения совета.
    .expense-details__section(v-if='hasDocuments')
      .t-eyebrow.t-muted {{ $t('ui.expenseProposalDetails.documentsTitle') }}
      BaseCard
        ExpenseProposalDocuments(:statement='proposal.statement_doc', :decision='proposal.decision_doc')

    .expense-details__section
      .t-eyebrow.t-muted {{ $t('ui.expenseProposalDetails.itemsTitle') }}
      .expense-details__items
        BaseCard(v-for='(item, idx) in itemRows', :key='item.item_hash')
          .expense-details__item
            .expense-details__item-head
              .expense-details__item-title {{ $t('ui.expenseProposalDetails.itemTitle', { index: idx + 1, description: item.description }) }}
              BaseChip(:variant='itemChip(item).variant') {{ itemChip(item).label }}
            .expense-details__rows
              DataRow(:label='$t("ui.expenseProposalDetails.recipientLabel")', :value='recipientOf(item)')
              DataRow(:label='$t("ui.expenseProposalDetails.paymentMethodLabel")', :value='mechanicsLabel(item.mechanics)')
              DataRow(:label='$t("ui.expenseProposalDetails.itemPlannedAmountLabel")', :value='formatAsset2Digits(item.planned_amount)')
              DataRow(v-if='hasAmount(item.actual_amount)', :label='$t("ui.expenseProposalDetails.itemActualAmountLabel")', :value='formatAsset2Digits(item.actual_amount)')
              DataRow(v-if='item.requisite', :label='$t("ui.expenseProposalDetails.recipientDetailsLabel")', :value='item.requisite.requisites')
              DataRow(v-if='item.requisite?.payment_purpose', :label='$t("ui.expenseProposalDetails.paymentPurposeLabel")', :value='item.requisite.payment_purpose')
            .expense-details__files(v-if='item.files.length')
              .t-sm.t-muted {{ $t('ui.expenseProposalDetails.supportingDocsTitle') }}
              button.expense-details__file(v-for='file in item.files', :key='file.id', type='button', :disabled='openingId === file.id', @click='openFile(file)')
                q-icon(name='attach_file', size='16px')
                span {{ fileKindLabel(file.kind) }}: {{ fileLabel(file) }}
                q-spinner(v-if='openingId === file.id', size='14px')

    //- Файлы без привязки к позиции — отдельной секцией, чтобы открыть любой приложенный документ.
    .expense-details__section(v-if='unmatchedFiles.length')
      .t-eyebrow.t-muted {{ $t('ui.expenseProposalDetails.otherDocsTitle') }}
      BaseCard
        .expense-details__files.expense-details__files--flat
          button.expense-details__file(v-for='file in unmatchedFiles', :key='file.id', type='button', :disabled='openingId === file.id', @click='openFile(file)')
            q-icon(name='attach_file', size='16px')
            span {{ fileKindLabel(file.kind) }}: {{ fileLabel(file) }}
            q-spinner(v-if='openingId === file.id', size='14px')

    .expense-details__section
      .t-eyebrow.t-muted {{ $t('ui.expenseProposalDetails.statusHistoryTitle') }}
      BaseCard
        ActivityTimeline(:events='timeline', group-by-date)

  EmptyState(v-else, :title='$t("ui.expenseProposalDetails.notFoundTitle")', :body='$t("ui.expenseProposalDetails.notFoundBody")')
    template(#icon)
      q-icon(name='receipt_long', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Zeus, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { FailAlert } from 'src/shared/api';
import { t, uiLocale } from 'src/shared/i18n';
import { useSystemStore } from 'src/entities/System/model';
import { BaseCard, BaseChip, EmptyState } from 'src/shared/ui/base';
import { DataRow } from '../DataRow';
import { ActivityTimeline, type ActivityEvent } from '../ActivityTimeline';
import { ExpenseProposalDocuments } from '../ExpenseProposalDocuments';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { fileKindLabel, itemStatusLabel, itemStatusVariant, mechanicsLabel, proposalStatusLabel, proposalStatusVariant, shortExpenseId, type ExpenseBadgeVariant } from 'src/shared/lib/expenses';
import type { ExpenseProposalAggregate, ExpenseProposalDetailsProps, ExpenseProposalFile, ExpenseProposalItem, ExpenseProposalRequisite } from './ExpenseProposalDetails.types';

const props = defineProps<ExpenseProposalDetailsProps>();
const emit = defineEmits<{ loaded: [proposal: ExpenseProposalAggregate | null] }>();

const system = useSystemStore();
const proposal = ref<ExpenseProposalAggregate | null>(null);
const files = ref<ExpenseProposalFile[]>([]);
const requisites = ref<ExpenseProposalRequisite[]>([]);
const loading = ref(false);

async function loadProposal(hash: string): Promise<ExpenseProposalAggregate | null> {
  const { [Queries.Expense.ExpenseProposal.name]: output } = await client.Query(Queries.Expense.ExpenseProposal.query, { variables: { proposal_hash: hash } });
  return output ?? null;
}
async function loadFiles(coopname: string, hash: string): Promise<ExpenseProposalFile[]> {
  const { [Queries.Expense.ExpenseFilesByProposal.name]: output } = await client.Query(Queries.Expense.ExpenseFilesByProposal.query, { variables: { coopname, proposal_hash: hash } });
  return output;
}
async function loadRequisites(coopname: string, hash: string): Promise<ExpenseProposalRequisite[]> {
  const { [Queries.Expense.ExpenseRequisitesByProposal.name]: output } = await client.Query(Queries.Expense.ExpenseRequisitesByProposal.query, { variables: { coopname, proposal_hash: hash } });
  return output;
}

/** Перечитать заявку: пул зовёт после своего действия либо по ленте изменений. */
async function refresh(): Promise<void> {
  const hash = props.expenseHash;
  if (!hash) return;
  loading.value = true;
  try {
    const coopname = system.info.coopname;
    // Реквизиты и файлы — вспомогательные: их отказ не прячет смету.
    const [proposalResult, filesResult, requisitesResult] = await Promise.allSettled([loadProposal(hash), loadFiles(coopname, hash), loadRequisites(coopname, hash)]);
    if (proposalResult.status === 'rejected') throw proposalResult.reason;
    proposal.value = proposalResult.value;
    files.value = filesResult.status === 'fulfilled' ? filesResult.value : [];
    requisites.value = requisitesResult.status === 'fulfilled' ? requisitesResult.value : [];
    emit('loaded', proposal.value);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
defineExpose({ refresh });

onMounted(refresh);
watch(() => props.expenseHash, () => void refresh());

const hasAmount = (v: string | null | undefined) => Number.parseFloat(v ?? '0') > 0;

// Документы показываются, когда пришёл их html — иначе открывать нечего.
const hasDocuments = computed(() => Boolean(proposal.value?.statement_doc?.rawDocument?.html) || Boolean(proposal.value?.decision_doc?.rawDocument?.html));

type ItemRow = ExpenseProposalItem & { requisite: ExpenseProposalRequisite | null; files: ExpenseProposalFile[] };

// Цепь отдаёт хэши в верхнем регистре, файловое хранилище — в нижнем.
const normalizeHash = (value?: string | null): string => (value ?? '').toLowerCase();

const itemRows = computed<ItemRow[]>(() =>
  (proposal.value?.items ?? []).map((item) => ({
    ...item,
    requisite: requisites.value.find((r) => normalizeHash(r.item_hash) === normalizeHash(item.item_hash)) ?? null,
    files: files.value.filter((f) => normalizeHash(f.item_hash) === normalizeHash(item.item_hash)),
  })),
);

const unmatchedFiles = computed<ExpenseProposalFile[]>(() => {
  const itemHashes = new Set((proposal.value?.items ?? []).map((i) => normalizeHash(i.item_hash)));
  return files.value.filter((f) => !itemHashes.has(normalizeHash(f.item_hash)));
});

/**
 * Состояние позиции — с оглядкой на заявку: пока совет не решил, позиция ничего
 * не ожидает, кроме решения; у отклонённой заявки оплат не будет.
 */
function itemChip(item: ExpenseProposalItem): { label: string; variant: ExpenseBadgeVariant } {
  const status = proposal.value?.status;
  if (status === Zeus.ExpenseProposalStatus.CREATED) return { label: t('ui.expenseProposalDetails.awaitingCouncilChip'), variant: 'neutral' };
  if (status === Zeus.ExpenseProposalStatus.DECLINED) return { label: t('ui.expenseProposalDetails.notPaidChip'), variant: 'neutral' };
  return { label: itemStatusLabel(item.status, item.mechanics), variant: itemStatusVariant(item.status) };
}

// Имена получателей ищутся по хэшу без учёта регистра — пулы отдают его по-разному.
const recipientNamesByHash = computed<Record<string, string>>(() => Object.fromEntries(Object.entries(props.recipientNames ?? {}).map(([hash, name]) => [normalizeHash(hash), name])));
const recipientOf = (item: ExpenseProposalItem): string => recipientNamesByHash.value[normalizeHash(item.item_hash)] ?? item.recipient;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '______';
  return new Date(iso).toLocaleString(uiLocale());
}

function fileLabel(file: ExpenseProposalFile): string {
  if (file.original_filename) return file.original_filename;
  const date = file.uploaded_at ? new Date(String(file.uploaded_at)).toLocaleString(uiLocale()) : '';
  return t('ui.expenseProposalDetails.docDateLabel', { date });
}

// Списочные запросы отдают файлы без read_url (он короткоживущий) — свежая ссылка по id в момент нажатия.
const openingId = ref<number | null>(null);
async function openFile(file: ExpenseProposalFile): Promise<void> {
  try {
    openingId.value = file.id;
    const { [Queries.Expense.ExpenseFile.name]: result } = await client.Query(Queries.Expense.ExpenseFile.query, { variables: { id: file.id } });
    if (!result.read_url) throw new Error(t('ui.expenseProposalDetails.fileUrlUnavailable'));
    window.open(result.read_url, '_blank', 'noopener');
  } catch (e) {
    FailAlert(e);
  } finally {
    openingId.value = null;
  }
}

function firstSignatureDate(doc: ExpenseProposalAggregate['statement_doc'] | null | undefined): string | null {
  const signatures = doc?.document?.signatures;
  return signatures?.length ? (signatures[0]?.signed_at ?? null) : null;
}

// История собирается из фактов, которые уже есть в данных: дат заявки,
// подписей документов и загруженных файлов. Отдельного журнала у шасси нет.
const timeline = computed<ActivityEvent[]>(() => {
  const p = proposal.value;
  if (!p) return [];
  const actor = props.creatorName || p.username || undefined;
  // Даты записи приходят необязательными: событие без даты встаёт по пустой строке.
  const at = (v: unknown): string => String(v ?? '');
  const events: ActivityEvent[] = [{ id: 'created', type: 'create', title: t('ui.expenseProposalDetails.historyMemoCreated'), actor, date: at(p.created_at) }];
  const statementSigned = firstSignatureDate(p.statement_doc);
  if (statementSigned) events.push({ id: 'statement', type: 'sign', title: t('ui.expenseProposalDetails.historyStatementSigned'), actor, date: statementSigned });
  const decisionSigned = firstSignatureDate(p.decision_doc);
  const declined = p.status === Zeus.ExpenseProposalStatus.DECLINED;
  if (decisionSigned || declined) {
    events.push({
      id: 'decision',
      type: declined ? 'reject' : 'sign',
      title: declined ? t('ui.expenseProposalDetails.historyRejected') : t('ui.expenseProposalDetails.historyApproved'),
      date: decisionSigned ?? at(p.updated_at),
    });
  }
  files.value.forEach((f) => events.push({ id: `file-${f.id}`, type: 'update', title: t('ui.expenseProposalDetails.historyDocAttached'), description: fileLabel(f), date: String(f.uploaded_at) }));
  if (p.status === Zeus.ExpenseProposalStatus.REPORT_SUBMITTED) events.push({ id: 'report', type: 'system', title: t('ui.expenseProposalDetails.historyReportSubmitted'), date: at(p.updated_at) });
  if (p.status === Zeus.ExpenseProposalStatus.CLOSED) events.push({ id: 'closed', type: 'system', title: t('ui.expenseProposalDetails.historyClosed'), date: at(p.updated_at) });
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
});
</script>

<style lang="scss" scoped>
.expense-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
}
.expense-details__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.expense-details__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
}
.expense-details__summary,
.expense-details__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.expense-details__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.expense-details__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.expense-details__item {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.expense-details__item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-2);
}
.expense-details__item-title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.expense-details__files {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-top: var(--p-2);
  border-top: 1px solid var(--p-line);
}
/* Секция вне карточки позиции — без разделителя сверху. */
.expense-details__files--flat {
  padding-top: 0;
  border-top: none;
}
.expense-details__file {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm);
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
</style>
