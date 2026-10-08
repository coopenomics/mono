<template lang="pug">
.loan-documents(v-if='docs.length')
  DocumentRow(
    v-for='doc in docs',
    :key='doc.key',
    :document='doc.row',
    @open='open(doc)'
  )

  //- Документ открывается во всплывающем окне на лист A4 по центру —
  //- канон крупных документов.
  BaseDialog(v-model='dialogOpen', :title='activeTitle', maximized)
    .row.justify-center
      .col-12.col-md-8
        BaseDocument(v-if='activeAggregate', :documentAggregate='activeAggregate')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import { DocumentRow } from 'src/shared/ui/domain/DocumentRow';
import type { DocumentRowDoc } from 'src/shared/ui/domain/DocumentRow';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import type { ILoan } from '../api';
import { formatDate } from '../model';
import { t } from '../i18n';

const props = defineProps<{ loan: ILoan }>();

interface DocEntry {
  key: string;
  title: string;
  aggregate: IDocumentAggregate;
  row: DocumentRowDoc;
}

// Документ показывается, только если пришёл его текст: открывать иначе нечего.
// Договор с подписью председателя заменяет в списке договор с одной подписью.
const docs = computed<DocEntry[]>(() => {
  const out: DocEntry[] = [];
  const add = (agg: unknown, title: string, key: string): void => {
    const aggregate = agg as IDocumentAggregate | null | undefined;
    if (!aggregate?.rawDocument?.html) return;
    const signatures = aggregate.document?.signatures ?? [];
    out.push({
      key,
      title,
      aggregate,
      row: {
        type: 'html',
        title,
        status: signatures.length ? 'signed' : undefined,
        date: formatDate(signatures[0]?.signed_at) || undefined,
      },
    });
  };
  add(props.loan.statement, t('debt.loanDetails.statementTitle'), 'statement');
  if (props.loan.signed_contract) {
    add(props.loan.signed_contract, t('debt.loanDetails.signedContractTitle'), 'signed_contract');
  } else {
    add(props.loan.contract, t('debt.loanDetails.contractTitle'), 'contract');
  }
  add(props.loan.decision, t('debt.loanDetails.decisionTitle'), 'decision');
  add(props.loan.extension_statement, t('debt.loanDetails.extensionStatementTitle'), 'extension_statement');
  return out;
});

const dialogOpen = ref(false);
const activeTitle = ref('');
const activeAggregate = ref<IDocumentAggregate | null>(null);

function open(doc: DocEntry): void {
  activeTitle.value = doc.title;
  activeAggregate.value = doc.aggregate;
  dialogOpen.value = true;
}
</script>

<style scoped lang="scss">
.loan-documents {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
</style>
