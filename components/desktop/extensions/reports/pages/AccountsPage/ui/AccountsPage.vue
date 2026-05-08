<template lang="pug">
div.page-shell
  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='accounts'
      :columns='columns'
      row-key='id'
      :pagination='pagination'
      :loading='loading'
      :no-data-label='"План счетов не найден"'
    )
      template(#header='props')
        q-tr(:props='props')
          q-th(v-for='col in props.cols' :key='col.name' :props='props') {{ col.label }}

      template(#body='props')
        q-tr(:key='`acc_${props.row.id}`' :props='props')
          q-td(auto-width)
            ExpandToggleButton(
              :expanded='expanded.has(props.row.id)'
              @click='toggleExpand(props.row.id)'
            )
          q-td
            AccountIdCell(:account-code='Math.round(props.row.id / 1000)')
          q-td {{ props.row.name }}
          q-td.text-right {{ formatAsset2Digits(props.row.debitBalance) }}
          q-td.text-right {{ formatAsset2Digits(props.row.creditBalance) }}
          q-td.text-right.text-weight-bold {{ formatAsset2Digits(props.row.balance) }}
          q-td
            span.text-weight-bold(
              :class='props.row.accountType === 0 ? "account-type-active" : "account-type-passive"'
            ) {{ props.row.accountType === 0 ? 'Активный' : 'Пассивный' }}

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.has(props.row.id)'
          :key='`exp_acc_${props.row.id}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-sm
              .row.items-center.q-mb-sm
                .col
                  .text-caption.text-grey-6 История проводок
                .col-auto
                  q-btn(
                    flat dense size='sm' color='primary'
                    icon='fa-solid fa-arrow-right'
                    label='Все операции'
                    :to='{ name: "reports-operations", query: { account_id: props.row.id } }'
                  )
              q-table(
                flat dense
                :rows='childOps.get(props.row.id) ?? []'
                :columns='childColumns'
                row-key='globalSequence'
                hide-pagination
                :pagination='{ rowsPerPage: 0 }'
                :loading='childLoading.has(props.row.id)'
                no-data-label='Проводок нет'
              )
                template(#body-cell-action='cp')
                  q-td(:props='cp')
                    span.text-weight-bold(
                      :class='cp.row.action === "debit" ? "account-type-active" : "account-type-passive"'
                    ) {{ cp.row.action === 'debit' ? 'Дебет' : 'Кредит' }}
                template(#body-cell-postingId='cp')
                  q-td(:props='cp')
                    EntityIdBadge(
                      :rawId='cp.row.globalSequence'
                      @click='copyText(String(cp.row.globalSequence))'
                    )
                      q-tooltip Клик — копировать
                template(#body-cell-processHash='cp')
                  q-td(:props='cp')
                    EntityIdBadge(
                      v-if='cp.row.processHash'
                      :rawId='shortHash(cp.row.processHash)'
                      @click='copyFullHash(cp.row.processHash)'
                    )
                      q-tooltip Клик — копировать полный хэш
                    span.text-grey-6(v-else) —
                template(#body-cell-quantity='cp')
                  q-td.text-right(:props='cp') {{ cp.row.quantity ? formatAsset2Digits(cp.row.quantity) : '—' }}
                template(#body-cell-createdAt='cp')
                  q-td(:props='cp') {{ formatDate(cp.row.createdAt) }}
                template(#body-cell-open='cp')
                  q-td.text-right(:props='cp')
                    q-btn(
                      v-if='cp.row.parentApplyGlobalSequence'
                      flat dense round size='sm' color='primary'
                      icon='fa-solid fa-arrow-right'
                      :to='{ name: "reports-operations", query: { operation_id: cp.row.parentApplyGlobalSequence } }'
                    )
                      q-tooltip К операции

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-h6.font-monospace {{ displayId(props.row.id) }}
                .text-body2 {{ props.row.name }}
                .text-caption.q-mt-xs.text-weight-bold(
                  :class='props.row.accountType === 0 ? "account-type-active" : "account-type-passive"'
                ) {{ props.row.accountType === 0 ? 'Активный' : 'Пассивный' }}
              .col-auto
                q-btn(
                  flat dense round size='sm' color='primary'
                  icon='fa-solid fa-arrow-right'
                  :to='{ name: "reports-operations", query: { account_id: props.row.id } }'
                )
                  q-tooltip К операциям счёта
            .row.q-mt-sm
              .col-4
                .text-caption.text-grey-6 Дебет
                .text-body2 {{ formatAsset2Digits(props.row.debitBalance) }}
              .col-4
                .text-caption.text-grey-6 Кредит
                .text-body2 {{ formatAsset2Digits(props.row.creditBalance) }}
              .col-4
                .text-caption.text-grey-6 Сальдо
                .text-body2.text-weight-bold {{ formatAsset2Digits(props.row.balance) }}
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { copyToClipboard } from 'quasar'
import { useWindowSize } from 'src/shared/hooks'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { useSystemStore } from 'src/entities/System/model'
import { useLedger2Store, type ILedger2Account, type ILedger2Operation } from 'src/entities/Ledger2'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton'
import { EntityIdBadge } from 'src/shared/ui'
import { AccountIdCell } from '../../../shared/ui'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const ledger2Store = useLedger2Store()

const loading = ref(false)
const pagination = ref({ rowsPerPage: 0 })
const accounts = ref<ILedger2Account[]>([])

const expanded = ref(new Set<number>())
const childOps = ref(new Map<number, ILedger2Operation[]>())
const childLoading = ref(new Set<number>())

function displayId(id: number): string {
  return String(Math.round(id / 1000))
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—'
  return hash.slice(0, 8)
}

async function copyText(text: string) {
  try {
    await copyToClipboard(text)
    SuccessAlert('Скопировано')
  } catch {
    FailAlert('Не удалось скопировать')
  }
}

async function copyFullHash(hash: string | null | undefined) {
  if (!hash) return
  await copyText(hash)
}

const columns: any[] = [
  { name: 'expand', align: 'left', label: '', field: 'expand', sortable: false },
  { name: 'id', align: 'left', label: 'Счёт', field: 'id', sortable: true },
  { name: 'name', align: 'left', label: 'Наименование', field: 'name', sortable: true },
  { name: 'debit', align: 'right', label: 'Дебет', field: 'debitBalance', sortable: true },
  { name: 'credit', align: 'right', label: 'Кредит', field: 'creditBalance', sortable: true },
  { name: 'balance', align: 'right', label: 'Сальдо', field: 'balance', sortable: true },
  { name: 'accountType', align: 'left', label: 'Тип', field: 'accountType', sortable: true },
]

const childColumns: any[] = [
  { name: 'action', align: 'left', label: 'Тип', field: 'action' },
  { name: 'postingId', align: 'left', label: '№ проводки', field: 'globalSequence' },
  { name: 'processHash', align: 'left', label: '№ процесса', field: 'processHash' },
  { name: 'quantity', align: 'right', label: 'Сумма', field: 'quantity' },
  { name: 'createdAt', align: 'left', label: 'Дата', field: 'createdAt' },
  { name: 'open', align: 'right', label: '', field: 'parentApplyGlobalSequence' },
]

async function toggleExpand(id: number) {
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
      accountId: id,
      actionNames: ['debit', 'credit'],
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
    accounts.value = await ledger2Store.loadAccounts(info.coopname)
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
// Тип счёта (Активный/Пассивный) и сторона проводки (Дебет/Кредит): subtle
// hue-различие при максимальной читаемости. quasar text-blue-grey-8 /
// text-brown-7 нечитаемы на тёмной теме — здесь theme-aware-варианты.
.account-type-active {
  color: #37474F; // blue-grey-9
  .body--dark & { color: #B0BEC5; } // blue-grey-3
}
.account-type-passive {
  color: #5D4037; // brown-8
  .body--dark & { color: #BCAAA4; } // brown-3
}
</style>
