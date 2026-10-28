<template lang="pug">
//- Сводка служебной записки для вопроса совета: цель, сумма, срок и позиции с
//- получателями. Совет читает её над документами вопроса, не открывая записку.
.expense-decision-info
  BaseCard
    .expense-decision-info__rows
      DataRow(:label='$t("ui.expenseProposalDecisionInfo.purposeLabel")', :value='header?.description || "—"')
      DataRow(:label='$t("ui.expenseProposalDecisionInfo.totalLabel")', :value='header?.total_amount ? formatAsset2Digits(header.total_amount) : "—"')
      DataRow(v-if='header?.deadline', :label='$t("ui.expenseProposalDecisionInfo.deadlineLabel")', :value='header.deadline')
      DataRow(v-if='header?.fund_name', :label='$t("ui.expenseProposalDecisionInfo.fundLabel")', :value='header.fund_name')

  .expense-decision-info__items(v-if='rows.length')
    .t-eyebrow.t-muted {{ $t('ui.expenseProposalDecisionInfo.itemsTitle') }}
    BaseCard(v-for='row in rows', :key='row.key')
      .expense-decision-info__item-title {{ $t('ui.expenseProposalDecisionInfo.itemTitle', { number: row.number, description: row.description }) }}
      .expense-decision-info__rows
        DataRow(:label='$t("ui.expenseProposalDecisionInfo.amountLabel")', :value='formatAsset2Digits(row.amount)')
        DataRow(:label='$t("ui.expenseProposalDecisionInfo.mechanicsLabel")', :value='mechanicsLabel(row.mechanics)')
        DataRow(:label='$t("ui.expenseProposalDecisionInfo.recipientLabel")', :value='row.recipient || "—"')
        DataRow(v-if='row.requisites', :label='$t("ui.expenseProposalDecisionInfo.requisitesLabel")', :value='row.requisites')
        DataRow(v-if='row.paymentPurpose', :label='$t("ui.expenseProposalDecisionInfo.paymentPurposeLabel")', :value='row.paymentPurpose')
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Queries, Zeus } from '@coopenomics/sdk';
import type { Cooperative } from 'cooptypes';
import type { IAgenda } from 'src/entities/Agenda/model';
import { useSystemStore } from 'src/entities/System/model';
import { client } from 'src/shared/api/client';
import { mechanicsLabel, proposalHeaderOf } from 'src/shared/lib/expenses';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { BaseCard } from 'src/shared/ui/base';
import { DataRow } from '../DataRow';
import type { ExpenseProposalItem, ExpenseProposalRequisite } from '../ExpenseProposalDetails';

/**
 * Сведения к вопросу совета о служебной записке-смете (решение `createexp`).
 * Шапку и позиции даёт подписанное заявление — его мета приходит с вопросом.
 * Получателей и реквизиты знает только шасси расходов: они вне цепи, совету их
 * отдаёт снимок реквизитов. Позиции заявления и строки цепи идут в одном
 * порядке — диалог создания собирает их из одного списка.
 */
const props = defineProps<{ agenda: IAgenda }>();

type StatementMeta = Partial<Cooperative.Registry.ExpenseProposalStatement.Action>;

const system = useSystemStore();
const chainItems = ref<ExpenseProposalItem[]>([]);
const requisites = ref<ExpenseProposalRequisite[]>([]);

const meta = computed<StatementMeta | null>(() => {
  const raw = props.agenda.table?.statement?.meta as unknown;
  if (!raw) return null;
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as StatementMeta;
  } catch {
    return null;
  }
});
const header = computed(() => proposalHeaderOf(meta.value));
const proposalHash = computed(() => String(meta.value?.proposal_hash ?? ''));

const applicantName = computed(() => {
  const certificate = props.agenda.table?.username_certificate;
  return (certificate ? getShortNameFromCertificate(certificate) : '') || props.agenda.table?.username || '';
});

const normalizeHash = (value?: string | null): string => (value ?? '').toLowerCase();

const rows = computed(() =>
  (meta.value?.items ?? []).map((item, idx) => {
    const chainItem = chainItems.value[idx];
    const requisite = chainItem ? requisites.value.find((r) => normalizeHash(r.item_hash) === normalizeHash(chainItem.item_hash)) : undefined;
    const isSelf = item.recipient_type === 'SELF';
    return {
      key: chainItem?.item_hash ?? `${idx}`,
      number: item.number,
      description: item.description,
      amount: item.amount,
      mechanics: item.mechanics === 'DIRECT' ? Zeus.ExpenseMechanics.DIRECT : Zeus.ExpenseMechanics.ADVANCE,
      // Сам заявитель — по сертификату вопроса; пайщик и организация — по снимку реквизитов.
      recipient: isSelf ? applicantName.value : requisite?.recipient || chainItem?.recipient || '',
      requisites: requisite?.requisites || '',
      paymentPurpose: requisite?.payment_purpose || '',
    };
  }),
);

async function load(): Promise<void> {
  const hash = proposalHash.value;
  if (!hash) return;
  const coopname = system.info.coopname;
  // Получатели — дополнение к заявлению: сбой их загрузки сводку не прячет.
  const [proposalResult, requisitesResult] = await Promise.allSettled([
    client.Query(Queries.Expense.ExpenseProposal.query, { variables: { proposal_hash: hash } }),
    client.Query(Queries.Expense.ExpenseRequisitesByProposal.query, { variables: { coopname, proposal_hash: hash } }),
  ]);
  chainItems.value = proposalResult.status === 'fulfilled' ? (proposalResult.value[Queries.Expense.ExpenseProposal.name]?.items ?? []) : [];
  requisites.value = requisitesResult.status === 'fulfilled' ? requisitesResult.value[Queries.Expense.ExpenseRequisitesByProposal.name] : [];
}

// realtime: записка на рассмотрении совета не меняется — получатели и реквизиты зафиксированы при подаче
watch(proposalHash, () => void load(), { immediate: true });
</script>

<style scoped>
.expense-decision-info {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.expense-decision-info__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.expense-decision-info__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
/* Как заголовок позиции в карточке расхода (ExpenseProposalDetails). */
.expense-decision-info__item-title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}
</style>
