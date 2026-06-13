<template lang="pug">
.process-detail
  .op-header.q-mb-md(:style='{ borderLeftColor: processAccentColor(processType) }')
    .text-h6.text-weight-medium {{ processTypeLabel(processType) }}
    .row.items-center.q-gutter-sm.q-mb-xs
      .text-caption.text-grey-7 ID процесса:
      EntityIdBadge(:rawId='processHash' copy-on-click)

  template(v-if='loading')
    q-spinner(size='sm')
  template(v-else)
    //- Документы процесса (наименование / дата / подписанты). Открываются во
    //- всплывающем окне без переадресации — агрегат уже загружен в getProcess.
    q-card.q-mb-md(flat bordered)
      q-card-section.q-pb-none
        .text-subtitle2 Документы
      q-card-section.q-pt-sm
        .text-body2.text-grey-7(v-if='!documents.length') Документы не приложены
        .column.q-gutter-xs(v-else)
          DocumentRow(
            v-for='d in documents'
            :key='docHash(d)'
            :document='toDocRow(d)'
            @open='openDoc(d)'
          )

    .row.q-col-gutter-md
      //- Операции процесса (apply + корректировки)
      .col-12.col-md-6
        q-card(flat bordered)
          q-card-section.q-pb-none
            .text-subtitle2 Операции
          q-card-section.q-pt-sm
            .text-body2.text-grey-7(v-if='!operations.length') Операций нет
            q-table(
              v-else
              flat dense
              :rows='operations'
              :columns='opColumns'
              row-key='globalSequence'
              hide-pagination
              :pagination='{ rowsPerPage: 0 }'
            )
              template(#body-cell-date='cp')
                q-td(:props='cp') {{ formatDate(cp.row.createdAt) }}
              template(#body-cell-op='cp')
                q-td(:props='cp')
                  EntityIdBadge(
                    v-if='operationRouteName'
                    :rawId='cp.row.globalSequence'
                    @click='goToOperation(cp.row.globalSequence)'
                  )
                    q-tooltip Открыть в реестре операций
                  EntityIdBadge(v-else :rawId='cp.row.globalSequence' copy-on-click)
              template(#body-cell-label='cp')
                q-td(:props='cp')
                  q-chip(
                    dense square
                    :color='processChipBg(processType)'
                    :text-color='processChipText(processType)'
                  ) {{ operationLabel(cp.row) }}
              template(#body-cell-amount='cp')
                q-td.text-right.font-monospace(:props='cp') {{ formatProcessAmount(cp.row.quantity) }}

      //- Проводки процесса (Дт → Кт парами)
      .col-12.col-md-6
        q-card(flat bordered)
          q-card-section.q-pb-none
            .text-subtitle2 Проводки
          q-card-section.q-pt-sm
            .text-body2.text-grey-7(v-if='!postings.length') Проводок нет
            q-table(
              v-else
              flat dense
              :rows='postings'
              :columns='pstColumns'
              row-key='key'
              hide-pagination
              :pagination='{ rowsPerPage: 0 }'
            )
              template(#body-cell-date='cp')
                q-td(:props='cp') {{ formatDate(cp.row.createdAt) }}
              template(#body-cell-posting='cp')
                q-td(:props='cp')
                  EntityIdBadge(
                    v-if='postingRouteName && cp.row.debitGlobalSequence'
                    :rawId='cp.row.debitGlobalSequence'
                    @click='goToPosting(cp.row.debitGlobalSequence)'
                  )
                    q-tooltip Открыть в реестре проводок
                  EntityIdBadge(
                    v-else-if='cp.row.debitGlobalSequence'
                    :rawId='cp.row.debitGlobalSequence'
                    copy-on-click
                  )
                  span.text-grey-6(v-else) —
              template(#body-cell-debit='cp')
                q-td.text-center(:props='cp')
                  AccountCodeBadge(:account-code='accountCodeFromId(cp.row.debitAccountId)')
              template(#body-cell-credit='cp')
                q-td.text-center(:props='cp')
                  AccountCodeBadge(:account-code='accountCodeFromId(cp.row.creditAccountId)')
              template(#body-cell-amount='cp')
                q-td.text-right.font-monospace(:props='cp') {{ formatProcessAmount(cp.row.quantity) }}

  //- Просмотр документа во всплывающем окне (без перехода в реестр документов
  //- совета — у пользователя может не быть к нему доступа).
  DocumentViewerDialog(
    v-model='viewerOpen'
    :document-aggregate='viewerDoc'
    :title='viewerTitle'
  )
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FailAlert } from 'src/shared/api'
import { EntityIdBadge } from 'src/shared/ui'
import { DocumentRow, type DocumentRowDoc } from 'src/shared/ui/domain/DocumentRow'
import { DocumentViewerDialog } from 'src/shared/ui/domain/DocumentViewerDialog'
import type { IDocumentAggregate } from 'src/entities/Document/model'
import {
  useProcessStore,
  type IProcessDocument,
} from 'src/entities/Process'
import {
  useLedger2Store,
  type ILedger2Operation,
  type ILedger2Posting,
} from 'src/entities/Ledger2'
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate'
import {
  processAccentColor,
  processChipBg,
  processChipText,
  processTypeLabel,
  operationLabel,
  accountCodeFromId,
  formatProcessAmount,
} from 'src/shared/lib/ledger2'
import AccountCodeBadge from './AccountCodeBadge.vue'

const props = defineProps<{
  /** Кооператив, в чьём реестре ищем процесс. */
  coopname: string
  /** Хэш процесса (для заказа marketplace = order_hash). */
  processHash: string
  /** Тип процесса (p.mkt.supply и т.д.) — определяет цвет/подпись. */
  processType: string
  /** Имя маршрута реестра операций. Задан → клик по № операции ведёт туда; не задан → копирование. */
  operationRouteName?: string
  /** Имя маршрута реестра проводок. Задан → клик по № проводки ведёт туда; не задан → копирование. */
  postingRouteName?: string
}>()

const router = useRouter()
const processStore = useProcessStore()
const ledger2Store = useLedger2Store()

const loading = ref(true)
const documents = ref<IProcessDocument[]>([])
const operations = ref<ILedger2Operation[]>([])
const postings = ref<ILedger2Posting[]>([])

const viewerOpen = ref(false)
const viewerDoc = ref<IDocumentAggregate | null>(null)
const viewerTitle = ref('')

const opColumns = [
  { name: 'date', align: 'left' as const, label: 'Дата', field: 'createdAt' },
  { name: 'op', align: 'left' as const, label: '№ операции', field: 'globalSequence' },
  { name: 'label', align: 'left' as const, label: 'Операция', field: 'operationCode' },
  { name: 'amount', align: 'right' as const, label: 'Сумма', field: 'quantity' },
]

const pstColumns = [
  { name: 'date', align: 'left' as const, label: 'Дата', field: 'createdAt' },
  { name: 'posting', align: 'left' as const, label: '№ проводки', field: 'debitGlobalSequence' },
  { name: 'debit', align: 'center' as const, label: 'Дебет', field: 'debitAccountId' },
  { name: 'credit', align: 'center' as const, label: 'Кредит', field: 'creditAccountId' },
  { name: 'amount', align: 'right' as const, label: 'Сумма', field: 'quantity' },
]

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// document.hash — хеш ПОДПИСАННОГО документа (по нему открывается документ);
// rawDocument.hash = doc_hash не подходит.
function docHash(d: IProcessDocument): string {
  const doc = d.document as any
  return doc?.hash || d.hash || ''
}

function toDocRow(d: IProcessDocument): DocumentRowDoc {
  const doc = d.document as any
  const raw = d.raw as any
  const signers: string[] = Array.isArray(doc?.signatures)
    ? doc.signatures
        .map((s: any) => getShortNameFromCertificate(s?.signer_certificate))
        .filter((x: string): x is string => !!x)
    : []
  return {
    type: 'pdf',
    title: doc?.meta?.title || raw?.full_title || 'Документ',
    date: doc?.meta?.created_at || undefined,
    author: signers.length ? signers.join(', ') : undefined,
  }
}

// Документ уже загружен целиком в getProcess (document + raw) — открываем во
// всплывающем окне через BaseDocument без догрузки и переадресации.
function openDoc(d: IProcessDocument) {
  const doc = d.document as any
  viewerDoc.value = { document: d.document, rawDocument: d.raw } as unknown as IDocumentAggregate
  viewerTitle.value = doc?.meta?.title || (d.raw as any)?.full_title || 'Документ'
  viewerOpen.value = true
}

function goToOperation(seq: string) {
  if (!props.operationRouteName) return
  router.push({ name: props.operationRouteName, query: { operation_id: seq } })
}
function goToPosting(id: string) {
  if (!props.postingRouteName) return
  router.push({ name: props.postingRouteName, query: { posting_id: id } })
}

async function copyText(text: string | null | undefined) {
  if (!text) return
  try {
    await copyToClipboard(text)
    SuccessAlert('Скопировано')
  } catch {
    FailAlert('Не удалось скопировать')
  }
}
// Утилита доступна для расширения (копирование произвольных значений детали).
void copyText

onMounted(async () => {
  try {
    // Документы + операции + проводки одного процесса грузим параллельно.
    const [view, history, post] = await Promise.all([
      processStore.loadProcess({ coopname: props.coopname, hash: props.processHash }),
      ledger2Store.loadHistory({
        coopname: props.coopname,
        processHash: props.processHash,
        actionNames: ['apply', 'walmove', 'revert'],
        limit: 100,
        sortOrder: 'ASC',
      }),
      ledger2Store.loadPostings({
        coopname: props.coopname,
        processHash: props.processHash,
        limit: 100,
        sortOrder: 'ASC',
      }),
    ])
    documents.value = view?.documents ?? []
    operations.value = history?.items ?? []
    postings.value = post?.items ?? []
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
.op-header {
  border-left: 4px solid #9e9e9e;
  padding: 4px 0 4px 12px;
}
</style>
