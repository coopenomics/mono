<template lang="pug">
//- Операция целиком в правой панели — одна на все реестры стола бухгалтера
//- (операции, проводки, процессы, счета, кошельки). Порядок чтения: сама
//- операция (сумма, дата, номер, код, назначение), её движения по кошелькам
//- и проводка, ниже — процесс, в котором она прошла. Разделы — заголовком и
//- линией, без карточек в карточке: приложение учётное и строгое.
DetailsDrawer(
  :model-value='!!operation'
  :title='title'
  :width='880'
  @update:model-value='(open) => { if (!open) emit("close") }'
)
  template(v-if='operation')
    .op-details__amount(v-if='operation.quantity')
      .op-details__eyebrow {{ $t('reports.operationDetails.amountLabel') }}
      .op-details__amount-value {{ formatAmount(operation.quantity) }}
    ProcessFacts.q-mt-md(:facts='facts')

    template(v-if='loading')
      TableSkeleton.op-details__section(:columns='SKELETON_COLUMNS', :rows='2')
    template(v-else)
      section.op-details__section
        h4.op-details__title {{ $t('reports.operationsPage.walletMovementsTitle') }}
        BaseTable(
          v-if='walletRows.length'
          :columns='walletColumns'
          :rows='walletRows'
          row-key='globalSequence'
        )
          template(#cell-direction='{ row }')
            DirectionCell(:direction='row.direction')
          template(#cell-walletFrom='{ row }')
            WalletIdCell(:wallet-name='row.walletFrom')
          template(#cell-walletTo='{ row }')
            WalletIdCell(:wallet-name='row.walletTo')
          template(#cell-quantity='{ row }') {{ formatAmount(row.quantity) }}
        .op-details__empty(v-else) {{ $t('reports.operationsPage.walletMovementsEmptyLabel') }}

      section.op-details__section
        h4.op-details__title {{ $t('reports.operationDetails.postingTitle') }}
        BaseTable(
          v-if='accountRows.length'
          :columns='accountColumns'
          :rows='accountRows'
          row-key='key'
        )
          template(#cell-debit='{ row }')
            AccountIdCell(:account-code='row.debitCode')
          template(#cell-credit='{ row }')
            AccountIdCell(:account-code='row.creditCode')
          template(#cell-quantity='{ row }') {{ formatAmount(row.quantity) }}
        .op-details__empty(v-else) {{ $t('reports.operationDetails.noPosting') }}

    //- Процесс операции: название, переход к процессу и его содержание.
    section.op-details__section(v-if='operation.processHash && processType')
      .op-details__title-row
        h4.op-details__title {{ $t('reports.operationDetails.processTitle', { name: processTypeLabel(processType) }) }}
        BaseButton(v-if='showProcessLink', variant='secondary', size='sm', @click='openProcess') {{ $t('reports.operationsPage.openProcessLabel') }}
      ProcessContent(
        :coopname='coopname'
        :process-hash='operation.processHash'
        :process-type='processType'
        :source='RegistrySource.ACCOUNTANT'
      )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Ledger2 } from 'cooptypes'
import { FailAlert } from 'src/shared/api'
import { BaseButton, BaseTable, TableSkeleton } from 'src/shared/ui/base'
import type { BaseTableColumn, TableSkeletonColumn } from 'src/shared/ui/base'
import { DetailsDrawer } from 'src/shared/ui/domain'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { RegistrySource } from 'src/shared/lib/registry-source'
import { ProcessContent, ProcessFacts, type ProcessFact } from 'src/widgets/Process/ProcessContentCard'
import { processTypeLabel } from 'src/shared/lib/ledger2'
import { uiLocale } from 'src/shared/i18n'
import type { ILedger2Operation } from 'src/entities/Ledger2'
import { useDeskRegistries } from 'app/extensions/reports/shared/lib/registries'
import { DirectionCell } from '../DirectionCell'
import { WalletIdCell } from '../WalletIdCell'
import { AccountIdCell } from '../AccountIdCell'
import { t } from '../../../i18n'
import type { OperationRef } from './types'

const props = withDefaults(defineProps<{
  /** Кооператив стола. */
  coopname: string
  /** Открытая операция; пусто — панель закрыта. */
  operation: OperationRef | null
  /** Кнопка «Открыть процесс»; реестр процессов её скрывает — процесс уже открыт. */
  showProcessLink?: boolean
}>(), { showProcessLink: true })

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const registries = useDeskRegistries()

const loading = ref(false)
const children = ref<ILedger2Operation[]>([])

const SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { label: t('reports.operationsPage.column.walletFrom') },
  { label: t('reports.operationsPage.column.walletTo') },
  { label: t('reports.operationsPage.column.amount'), width: '120px', class: 'col-num' },
]

const walletColumns: BaseTableColumn[] = [
  { key: 'direction', label: '', align: 'center', width: '120px', nowrap: true },
  { key: 'walletFrom', label: t('reports.operationsPage.column.walletFrom') },
  { key: 'walletTo', label: t('reports.operationsPage.column.walletTo') },
  { key: 'quantity', label: t('reports.operationsPage.column.amount'), align: 'right', numeric: true, nowrap: true },
]

const accountColumns: BaseTableColumn[] = [
  { key: 'debit', label: t('reports.operationsPage.column.debit'), align: 'center' },
  { key: 'credit', label: t('reports.operationsPage.column.credit'), align: 'center' },
  { key: 'quantity', label: t('reports.operationsPage.column.amount'), align: 'right', numeric: true, nowrap: true },
]

/** Тип процесса операции — по нему узел подбирает описание содержания. */
const processType = computed(() => Ledger2.getOperationProcessType(props.operation?.operationCode) ?? '')

/** Название операции из реестра операций; корректировки — по имени действия. */
const title = computed(() => {
  const op = props.operation
  if (!op) return ''
  if (op.operationCode) return Ledger2.getOperationHumanName(op.operationCode) ?? op.operationCode
  if (op.action === 'walmove') return Ledger2.getOperationHumanName('o.adj.walmove') ?? t('reports.operationsPage.operationType.walletTransfer')
  if (op.action === 'revert') return Ledger2.getOperationHumanName('o.adj.rev') ?? t('reports.operationsPage.operationType.rollback')
  return '—'
})

/** Операция: дата, номер, код и назначение — сеткой «подпись над значением». */
const facts = computed<ProcessFact[]>(() => {
  const op = props.operation
  if (!op) return []
  return [
    { label: t('reports.operationDetails.date'), value: op.createdAt ? formatDate(op.createdAt) : '' },
    { label: t('reports.operationDetails.number'), value: op.globalSequence, mono: true },
    { label: t('reports.operationDetails.code'), value: op.operationCode ?? op.action ?? '', mono: true },
    { label: t('reports.operationDetails.memo'), value: op.memo ?? '', wide: true },
  ]
})

function formatDate(value: unknown): string {
  return new Date(value as string | Date).toLocaleString(uiLocale(), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Движения по кошелькам операции: приход, расход либо перевод. */
const walletRows = computed(() =>
  children.value
    .filter((o) => o.action === 'walletop')
    .map((o) => {
      const from = o.walletFrom ?? null
      const to = o.walletTo ?? null
      const direction: 'in' | 'out' | 'move' = from && !to ? 'out' : !from && to ? 'in' : 'move'
      return { globalSequence: String(o.globalSequence), direction, walletFrom: from, walletTo: to, quantity: o.quantity ?? null }
    }),
)

/** Проводка операции парой «Дт — Кт»; без проводки — пусто. */
const accountRows = computed(() => {
  const debit = children.value.find((o) => o.action === 'debit')
  const credit = children.value.find((o) => o.action === 'credit')
  if (!debit && !credit) return []
  return [{
    key: 'pair',
    debitCode: debit?.accountId != null ? Math.round(debit.accountId / 1000) : null,
    creditCode: credit?.accountId != null ? Math.round(credit.accountId / 1000) : null,
    quantity: debit?.quantity ?? credit?.quantity ?? null,
  }]
})

function formatAmount(qty: string | null | undefined): string {
  return qty ? formatAsset2Digits(qty) : '—'
}

async function loadChildren(op: OperationRef): Promise<void> {
  if (!op.processHash) return
  loading.value = true
  try {
    const resp = await registries.loadHistory({
      coopname: props.coopname,
      processHash: op.processHash,
      parentApplyGlobalSequence: op.globalSequence,
      actionNames: ['walletop', 'debit', 'credit'],
      limit: 10,
      sortOrder: 'ASC',
    })
    if (props.operation?.globalSequence === op.globalSequence) children.value = resp?.items ?? []
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.operation?.globalSequence,
  () => {
    children.value = []
    const op = props.operation
    if (op) void loadChildren(op)
  },
  { immediate: true },
)

function openProcess(): void {
  const hash = props.operation?.processHash
  if (!hash) return
  emit('close')
  void router.push({ name: 'reports-processes', params: { coopname: props.coopname }, query: { process: hash } }) // i18n-ignore
}
</script>

<style scoped>
.op-details__eyebrow {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin-bottom: var(--p-1);
}
.op-details__amount-value {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  font-family: var(--p-mono);
  color: var(--p-ink);
}
.op-details__section {
  margin-top: var(--p-6);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.op-details__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  margin-bottom: var(--p-3);
}
.op-details__title {
  margin: 0 0 var(--p-3);
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.op-details__title-row .op-details__title {
  margin-bottom: 0;
}
.op-details__empty {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
</style>
