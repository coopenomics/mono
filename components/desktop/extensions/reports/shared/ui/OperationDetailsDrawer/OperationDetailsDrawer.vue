<template lang="pug">
//- Операция целиком в правой панели — одна на все реестры стола бухгалтера
//- (операции, проводки, процессы, счета): содержание процесса операции,
//- движения по кошелькам и проводки по счетам. Строка реестра открывает
//- панель на месте, без перехода на другую страницу.
DetailsDrawer(
  :model-value='!!operation'
  :title='title'
  :width='760'
  @update:model-value='(open) => { if (!open) emit("close") }'
)
  template(v-if='operation')
    //- Шапка: код операции, процесс и назначение. Название — в заголовке панели.
    .op-details__meta
      .op-details__row(v-if='operation.operationCode')
        .t-muted {{ $t('reports.operationsPage.processTypeLabel') }}
        EntityIdBadge(:rawId='operation.operationCode' copy-on-click)
      .op-details__row(v-if='operation.processHash')
        .t-muted {{ $t('reports.operationsPage.processIdLabel') }}
        EntityIdBadge(:rawId='operation.processHash' copy-on-click)
      .op-details__row(v-if='operation.memo')
        q-icon(name='sticky_note_2' size='xs')
        .t-muted {{ operation.memo }}

    //- Содержание процесса: имущество, стороны, суммы, состояние.
    ProcessContent.q-mt-md(
      v-if='operation.processHash && processType'
      :coopname='coopname'
      :process-hash='operation.processHash'
      :process-type='processType'
      :source='RegistrySource.ACCOUNTANT'
    )
    .q-mt-md(v-if='operation.processHash && showProcessLink')
      BaseButton(variant='secondary', size='sm', @click='openProcess') {{ $t('reports.operationsPage.openProcessLabel') }}

    //- Движения по кошелькам и проводки — одна под другой на всю ширину панели.
    template(v-if='loading')
      TableSkeleton.q-mt-md(:columns='SKELETON_COLUMNS', :rows='2')
    template(v-else)
      BaseCard.q-mt-md(variant='flat', :title='$t("reports.operationsPage.walletMovementsTitle")')
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
        .t-faint(v-else) {{ $t('reports.operationsPage.walletMovementsEmptyLabel') }}

      BaseCard.q-mt-md(variant='flat', :title='$t("reports.operationsPage.postingsTitle")')
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
        .t-faint(v-else) {{ $t('reports.operationsPage.postingsEmptyLabel') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Ledger2 } from 'cooptypes'
import { FailAlert } from 'src/shared/api'
import { EntityIdBadge } from 'src/shared/ui'
import { BaseButton, BaseCard, BaseTable, TableSkeleton } from 'src/shared/ui/base'
import type { BaseTableColumn, TableSkeletonColumn } from 'src/shared/ui/base'
import { DetailsDrawer } from 'src/shared/ui/domain'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { RegistrySource } from 'src/shared/lib/registry-source'
import { ProcessContent } from 'src/widgets/Process/ProcessContentCard'
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
.op-details__meta {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.op-details__row {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
}
</style>
