<template lang="pug">
.process-detail
  .op-header.q-mb-md(:style='{ borderLeftColor: processAccentColor(processType) }')
    .text-h6.text-weight-medium {{ processTypeLabel(processType) }}
    .row.items-center.q-gutter-sm.q-mb-xs
      .text-caption.text-grey-7 {{ $t('process.processDetailCard.processIdLabel') }}
      EntityIdBadge(:rawId='processHash' copy-on-click)

  //- Загрузка: каркас на местах документов, операций и проводок. Спиннер
  //- крутился у левого края под шапкой — по нему не видно ни что грузится, ни
  //- сколько там будет содержимого (канон: скелетон, не спиннер).
  template(v-if='loading')
    BaseCard.q-mb-md(variant='flat', :title='$t("process.processDetailCard.documentsTitle")')
      CardListSkeleton(:count='2')

    .row.q-col-gutter-md
      .col-12
        BaseCard(variant='flat', :title='$t("process.processDetailCard.operationsTitle")')
          TableSkeleton(:columns='OP_SKELETON_COLUMNS', :rows='4')
      .col-12
        BaseCard(variant='flat', :title='$t("process.processDetailCard.postingsTitle")')
          TableSkeleton(:columns='PST_SKELETON_COLUMNS', :rows='3')
  template(v-else)
    //- Документы процесса (наименование / дата / подписанты). Открываются во
    //- всплывающем окне без переадресации — агрегат уже загружен в getProcess.
    q-card.q-mb-md(flat bordered)
      q-card-section.q-pb-none
        .text-subtitle2 {{ $t('process.processDetailCard.documentsTitle') }}
      q-card-section.q-pt-sm
        .text-body2.text-grey-7(v-if='!documents.length') {{ $t('process.processDetailCard.documentsEmpty') }}
        .column.q-gutter-xs(v-else)
          DocumentRow(
            v-for='d in documents'
            :key='docHash(d)'
            :document='toDocRow(d)'
            @open='openDoc(d)'
          )

    //- Операции и проводки — каждая на всю ширину, одна под другой: рядом в две
    //- колонки обе таблицы обрезались по горизонтали, и ни номер операции, ни
    //- пара счетов целиком не читались (особенно в оверлее заказа).
    .row.q-col-gutter-md
      //- Операции процесса (apply + корректировки)
      .col-12
        q-card(flat bordered)
          q-card-section.q-pb-none
            .text-subtitle2 {{ $t('process.processDetailCard.operationsTitle') }}
          q-card-section.q-pt-sm
            .text-body2.text-grey-7(v-if='!operations.length') {{ $t('process.processDetailCard.operationsEmpty') }}
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
                    q-tooltip {{ $t('process.processDetailCard.openInOperationsRegistry') }}
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
      .col-12
        q-card(flat bordered)
          q-card-section.q-pb-none
            .text-subtitle2 {{ $t('process.processDetailCard.postingsTitle') }}
          q-card-section.q-pt-sm
            .text-body2.text-grey-7(v-if='!postings.length') {{ $t('process.processDetailCard.postingsEmpty') }}
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
                    q-tooltip {{ $t('process.processDetailCard.openInPostingsRegistry') }}
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
import { Ledger2Contract, SovietContract } from 'cooptypes'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { uiLocale, t } from 'src/shared/i18n';
import { useRouter } from 'vue-router'
import { copyToClipboard } from 'quasar'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { EntityIdBadge } from 'src/shared/ui'
import { BaseCard, CardListSkeleton, TableSkeleton } from 'src/shared/ui/base'
import type { TableSkeletonColumn } from 'src/shared/ui/base'
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
  { name: 'date', align: 'left' as const, label: t('process.processDetailCard.dateColumn'), field: 'createdAt' },
  { name: 'op', align: 'left' as const, label: t('process.processDetailCard.opNumberColumn'), field: 'globalSequence' },
  { name: 'label', align: 'left' as const, label: t('process.processDetailCard.operationColumn'), field: 'operationCode' },
  { name: 'amount', align: 'right' as const, label: t('process.processDetailCard.amountColumn'), field: 'quantity' },
]

const pstColumns = [
  { name: 'date', align: 'left' as const, label: t('process.processDetailCard.dateColumn'), field: 'createdAt' },
  { name: 'posting', align: 'left' as const, label: t('process.processDetailCard.postingNumberColumn'), field: 'debitGlobalSequence' },
  { name: 'debit', align: 'center' as const, label: t('process.processDetailCard.debitColumn'), field: 'debitAccountId' },
  { name: 'credit', align: 'center' as const, label: t('process.processDetailCard.creditColumn'), field: 'creditAccountId' },
  { name: 'amount', align: 'right' as const, label: t('process.processDetailCard.amountColumn'), field: 'quantity' },
]

// Каркас повторяет шапки тех же таблиц: при подстановке данных заголовки и
// колонки остаются на месте, содержимое просто заполняет готовую сетку.
const OP_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { label: t('process.processDetailCard.dateColumn'), width: '150px' },
  { label: t('process.processDetailCard.opNumberColumn'), width: '120px', cell: 'badge' },
  { label: t('process.processDetailCard.operationColumn'), cell: 'badge' },
  { label: t('process.processDetailCard.amountColumn'), width: '120px', class: 'col-num' },
]

const PST_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { label: t('process.processDetailCard.dateColumn'), width: '150px' },
  { label: t('process.processDetailCard.postingNumberColumn'), width: '120px', cell: 'badge' },
  { label: t('process.processDetailCard.debitColumn'), width: '90px', cell: 'badge' },
  { label: t('process.processDetailCard.creditColumn'), width: '90px', cell: 'badge' },
  { label: t('process.processDetailCard.amountColumn'), width: '120px', class: 'col-num' },
]

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString(uiLocale(), {
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
    title: doc?.meta?.title || raw?.full_title || t('process.processDetailCard.documentFallbackTitle'),
    date: doc?.meta?.created_at || undefined,
    author: signers.length ? signers.join(', ') : undefined,
  }
}

// Документ уже загружен целиком в getProcess (document + raw) — открываем во
// всплывающем окне через BaseDocument без догрузки и переадресации.
function openDoc(d: IProcessDocument) {
  const doc = d.document as any
  viewerDoc.value = { document: d.document, rawDocument: d.raw } as unknown as IDocumentAggregate
  viewerTitle.value = doc?.meta?.title || (d.raw as any)?.full_title || t('process.processDetailCard.documentFallbackTitle')
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
    SuccessAlert(t('process.processDetailCard.copied'))
  } catch {
    FailAlert(t('process.processDetailCard.copyFailed'))
  }
}
// Утилита доступна для расширения (копирование произвольных значений детали).
void copyText

async function load(): Promise<void> {
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
}

onMounted(load)

// Процесс живёт по ленте: новый документ, решение совета, операция и проводка
// учёта появляются в карточке сами.
useLiveReload(
  [
    liveTable(Ledger2Contract, Ledger2Contract.Tables.Accounts),
    liveTable(Ledger2Contract, Ledger2Contract.Tables.Wallets),
    liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
    liveTable(SovietContract, SovietContract.Tables.Decisions),
    { code: 'core', table: 'signed_documents' },
  ],
  load,
)
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
