<template>
  <q-timeline class="mp-wallet-timeline" :layout="layout" color="primary">
    <q-timeline-entry
      v-for="e in entries"
      :key="e.id"
      :title="e.title"
      :subtitle="formatDate(e.at)"
      :icon="iconOf(e.kind)"
      :color="colorOf(e.kind)"
    >
      <div class="row items-center q-gutter-md">
        <div :class="['text-h6', amountClass(e)]">
          {{ amountSign(e) }}{{ formatAmount(e.amount) }} ₽
        </div>
        <q-badge outline :color="colorOf(e.kind)">
          {{ kindLabel[e.kind] }}
        </q-badge>
        <q-badge v-if="e.orderId" outline color="grey-7">
          MP-{{ e.orderId }}
        </q-badge>
      </div>
      <div v-if="e.note" class="text-body2 text-grey-7 q-mt-xs">{{ e.note }}</div>
    </q-timeline-entry>

    <q-timeline-entry v-if="!entries.length" subtitle="История пуста" title="Операций пока нет">
      <div class="text-grey-7">Когда вы оплатите заказ или получите выплату — записи появятся здесь.</div>
    </q-timeline-entry>
  </q-timeline>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

export type WalletEntryKind = 'deposit' | 'block' | 'unblock' | 'charge' | 'refund' | 'payout'

export interface WalletEntry {
  id: string | number
  at: string | Date
  kind: WalletEntryKind
  amount: number
  title: string
  note?: string
  orderId?: string | number
}

defineProps({
  entries: { type: Array as PropType<WalletEntry[]>, required: true },
  layout:  { type: String as PropType<'comfortable' | 'dense' | 'loose'>, default: 'comfortable' },
})

const kindLabel: Record<WalletEntryKind, string> = {
  deposit:  'Пополнение',
  block:    'Блокировка',
  unblock:  'Разблокировка',
  charge:   'Списание',
  refund:   'Возврат',
  payout:   'Выплата',
}

function colorOf(k: WalletEntryKind): string {
  return ({
    deposit:  'positive',
    block:    'warning',
    unblock:  'grey-7',
    charge:   'negative',
    refund:   'positive',
    payout:   'info',
  } as const)[k]
}

function iconOf(k: WalletEntryKind): string {
  return ({
    deposit:  'fa-solid fa-circle-down',
    block:    'fa-solid fa-lock',
    unblock:  'fa-solid fa-lock-open',
    charge:   'fa-solid fa-circle-up',
    refund:   'fa-solid fa-rotate-left',
    payout:   'fa-solid fa-money-bill-transfer',
  } as const)[k]
}

function amountSign(e: WalletEntry): string {
  if (e.kind === 'deposit' || e.kind === 'refund' || e.kind === 'payout' || e.kind === 'unblock') return '+'
  if (e.kind === 'charge' || e.kind === 'block') return '−'
  return ''
}

function amountClass(e: WalletEntry): string {
  if (e.kind === 'deposit' || e.kind === 'refund' || e.kind === 'payout') return 'text-positive'
  if (e.kind === 'charge') return 'text-negative'
  return 'text-grey-9'
}

function formatAmount(v: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.abs(v))
}

function formatDate(v: string | Date): string {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
