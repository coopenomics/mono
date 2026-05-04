<template lang="pug">
div.page-shell
  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='wallets'
      :columns='columns'
      row-key='id'
      :pagination='pagination'
      :loading='loading'
      :no-data-label='"Кошельки не найдены"'
    )
      template(#header='props')
        q-tr(:props='props')
          q-th(v-for='col in props.cols' :key='col.name' :props='props') {{ col.label }}

      template(#body='props')
        q-tr(:key='`wallet_${props.row.id}`' :props='props')
          q-td(auto-width)
            ExpandToggleButton(
              :expanded='expanded.has(props.row.id)'
              @click='toggleExpand(props.row.id)'
            )
          q-td.font-monospace {{ props.row.id }}
          q-td {{ props.row.name }}
          q-td.text-right {{ formatAsset2Digits(props.row.available) }}
          q-td.text-right {{ formatAsset2Digits(props.row.blocked) }}
          q-td.text-right(auto-width)
            q-btn(
              v-if='isChairman'
              flat dense round size='sm' color='primary'
              icon='fa-solid fa-arrow-right-arrow-left'
              @click='openTransferFor(props.row.id)'
            )
              q-tooltip Перевести с этого кошелька

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.has(props.row.id)'
          :key='`exp_wal_${props.row.id}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-sm
              .row.items-center.q-mb-sm
                .col
                  .text-caption.text-grey-6 Движения по кошельку
                .col-auto
                  q-btn(
                    flat dense size='sm' color='primary'
                    icon='fa-solid fa-arrow-right'
                    label='К операциям'
                    :to='{ name: "reports-operations", query: { wallet_name: props.row.id } }'
                  )
              q-table(
                flat dense
                :rows='childOps.get(props.row.id) ?? []'
                :columns='childColumns'
                row-key='globalSequence'
                hide-pagination
                :pagination='{ rowsPerPage: 0 }'
                :loading='childLoading.has(props.row.id)'
                no-data-label='Движений нет'
              )
                template(#body-cell-direction='cp')
                  q-td(:props='cp')
                    DirectionCell(:direction='directionFor(cp.row, String(props.row.id))')
                template(#body-cell-walletFrom='cp')
                  q-td(:props='cp')
                    WalletIdCell(:wallet-name='cp.row.walletFrom')
                template(#body-cell-walletTo='cp')
                  q-td(:props='cp')
                    WalletIdCell(:wallet-name='cp.row.walletTo')
                template(#body-cell-quantity='cp')
                  q-td.text-right(:props='cp') {{ cp.row.quantity ? formatAsset2Digits(cp.row.quantity) : '—' }}
                template(#body-cell-memo='cp')
                  q-td.memo-cell(:props='cp') {{ cp.row.memo || '—' }}
                template(#body-cell-createdAt='cp')
                  q-td(:props='cp') {{ formatDate(cp.row.createdAt) }}
                template(#body-cell-open='cp')
                  q-td.text-right(:props='cp')
                    q-btn(
                      v-if='cp.row.processHash'
                      flat dense round size='sm' color='primary'
                      icon='fa-solid fa-up-right-from-square'
                      :to='{ name: "reports-operations", query: { process_hash: cp.row.processHash } }'
                    )
                      q-tooltip Показать операцию

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-body1 {{ props.row.name }}
                .text-caption.text-grey-6.font-monospace ID: {{ props.row.id }}
              .col-auto
                ExpandToggleButton(
                  :expanded='expanded.has(props.row.id)'
                  @click='toggleExpand(props.row.id)'
                )
            .row.q-mt-sm
              .col-6
                .text-caption.text-grey-6 Доступно
                .text-body2.text-weight-medium {{ formatAsset2Digits(props.row.available) }}
              .col-6
                .text-caption.text-grey-6 Заблокировано
                .text-body2.text-weight-medium {{ formatAsset2Digits(props.row.blocked) }}

  WalletTransferDialog(
    v-model='transferDialog.open'
    :wallets='wallets'
    :fixed-from-wallet='transferDialog.fromWallet'
    @success='onTransferSuccess'
  )
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useWindowSize } from 'src/shared/hooks'
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { useSystemStore } from 'src/entities/System/model'
import { useSessionStore } from 'src/entities/Session/model'
import { useLedger2Store, type ILedger2Wallet, type ILedger2Operation } from 'src/entities/Ledger2'
import { FailAlert } from 'src/shared/api'
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton'
import { DirectionCell, WalletIdCell } from '../../../shared/ui'
import WalletTransferDialog from './WalletTransferDialog.vue'
import TransferWalletsButton from './TransferWalletsButton.vue'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const ledger2Store = useLedger2Store()
const session = useSessionStore()
const { isChairman } = storeToRefs(session)

const { registerAction, unregisterAction } = useHeaderActions()
const HEADER_ACTION_ID = 'reports-wallets-coop-transfer'

const loading = ref(false)
const pagination = ref({ rowsPerPage: 0 })
const wallets = ref<ILedger2Wallet[]>([])

// Идентификатор кошелька — eosio::name (строка `w.<contract>.<waltype>`).
const expanded = ref(new Set<string>())
const childOps = ref(new Map<string, ILedger2Operation[]>())
const childLoading = ref(new Set<string>())

const transferDialog = reactive<{ open: boolean; fromWallet: string | null }>({
  open: false,
  fromWallet: null,
})

function openTransferEmpty(): void {
  transferDialog.fromWallet = null
  transferDialog.open = true
}

function openTransferFor(walletName: string): void {
  transferDialog.fromWallet = walletName
  transferDialog.open = true
}

async function onTransferSuccess(): Promise<void> {
  // Перезагружаем кошельки и сбрасываем кэш развёрнутых движений.
  childOps.value.clear()
  expanded.value.clear()
  try {
    wallets.value = await ledger2Store.loadWallets(info.coopname)
  } catch (e) {
    FailAlert(e)
  }
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const columns = computed<any[]>(() => {
  const base: any[] = [
    { name: 'expand', align: 'left', label: '', field: 'expand', sortable: false },
    { name: 'id', align: 'left', label: 'ID', field: 'id', sortable: true },
    { name: 'name', align: 'left', label: 'Наименование', field: 'name', sortable: true },
    { name: 'available', align: 'right', label: 'Доступно', field: 'available', sortable: true },
    { name: 'blocked', align: 'right', label: 'Заблокировано', field: 'blocked', sortable: true },
  ]
  if (isChairman.value) {
    base.push({ name: 'actions', align: 'right', label: '', field: 'actions', sortable: false })
  }
  return base
})

const childColumns: any[] = [
  { name: 'direction', align: 'center', label: '', field: 'direction' },
  { name: 'walletFrom', align: 'left', label: 'Из', field: 'walletFrom' },
  { name: 'walletTo', align: 'left', label: 'В', field: 'walletTo' },
  { name: 'quantity', align: 'right', label: 'Сумма', field: 'quantity' },
  { name: 'memo', align: 'left', label: 'Примечание', field: 'memo' },
  { name: 'createdAt', align: 'left', label: 'Дата', field: 'createdAt' },
  { name: 'open', align: 'right', label: '', field: 'processHash' },
]

function directionFor(op: ILedger2Operation, walletName: string): 'in' | 'out' | 'move' {
  const from = op.walletFrom ?? null
  const to = op.walletTo ?? null
  if (from === walletName && to && to !== walletName) return 'out'
  if (to === walletName && from && from !== walletName) return 'in'
  if (to === walletName && !from) return 'in'
  if (from === walletName && !to) return 'out'
  return 'move'
}

async function toggleExpand(id: string) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
    return
  }
  expanded.value.add(id)
  if (childOps.value.has(id)) return
  childLoading.value.add(id)
  try {
    const resp = await ledger2Store.loadHistory({
      coopname: info.coopname,
      walletName: id,
      actionNames: ['walletop'],
      limit: 20,
      sortOrder: 'DESC',
    })
    childOps.value.set(id, resp?.items ?? [])
  } catch (e) {
    FailAlert(e)
  } finally {
    childLoading.value.delete(id)
  }
}

onMounted(async () => {
  try {
    loading.value = true
    wallets.value = await ledger2Store.loadWallets(info.coopname)
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }

  // Кнопка «Перевести» в шапке сайта — только председателю.
  // Регистрируем после загрузки, чтобы не мигала на ходу.
  if (isChairman.value) {
    registerAction({
      id: HEADER_ACTION_ID,
      component: markRaw(TransferWalletsButton),
      props: { onClick: openTransferEmpty },
      order: 10,
    })
  }
})

onBeforeUnmount(() => {
  unregisterAction(HEADER_ACTION_ID)
})
</script>

<style scoped>
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
.memo-cell {
  max-width: 240px;
  white-space: normal;
  word-break: break-word;
}
</style>
