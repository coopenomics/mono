<template lang="pug">
.expense-proposal-documents(v-if='docs.length')
  DocumentRow(
    v-for='doc in docs',
    :key='doc.key',
    :document='doc.row',
    @open='open(doc)'
  )

  //- Просмотр документа во всплывающем окне — канон крупных документов
  //- (как оферта/соглашение): maximized BaseDialog + BaseDocument (стили
  //- документа через ShadowHtml + раскрывающийся блок подписей).
  BaseDialog(
    v-model='dialogOpen',
    :title='activeTitle',
    maximized
  )
    //- Лист A4 не должен растягиваться на всю ширину макси-диалога —
    //- центрируем в колонке (канон ComplexDocument/ExpandableDocument).
    .row.justify-center
      .col-12.col-md-8
        BaseDocument(
          v-if='activeAggregate',
          :documentAggregate='activeAggregate'
        )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import { DocumentRow } from '../DocumentRow';
import type { DocumentRowDoc } from '../DocumentRow';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import type { ExpenseProposalDocumentsProps } from './ExpenseProposalDocuments.types';

const props = defineProps<ExpenseProposalDocumentsProps>();

interface DocEntry {
  key: string;
  title: string;
  aggregate: IDocumentAggregate;
  row: DocumentRowDoc;
}

function firstSignedAt(agg: IDocumentAggregate): string | undefined {
  const signatures = agg.document?.signatures;
  if (!signatures?.length) return undefined;
  return signatures[0]?.signed_at ?? undefined;
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleDateString('ru-RU');
  } catch {
    return iso;
  }
}

// Документ показываем, только если пришёл его html (rawDocument) — иначе
// открывать нечего и строка не появляется.
const docs = computed<DocEntry[]>(() => {
  const out: DocEntry[] = [];
  const add = (agg: IDocumentAggregate | null | undefined, fallbackTitle: string, key: string): void => {
    if (!agg?.rawDocument?.html) return;
    out.push({
      key,
      title: agg.rawDocument.full_title || fallbackTitle,
      aggregate: agg,
      row: {
        type: 'html',
        title: fallbackTitle,
        status: agg.document?.signatures?.length ? 'signed' : undefined,
        date: formatDate(firstSignedAt(agg)),
      },
    });
  };
  add(props.statement, 'Служебная записка', 'statement');
  add(props.decision, 'Протокол решения совета', 'decision');
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

<style scoped>
.expense-proposal-documents {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
</style>
