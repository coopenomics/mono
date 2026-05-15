<template>
  <q-timeline class="mp-wallet-timeline" :layout="layout" color="primary">
    <q-timeline-entry
      v-for="e in entries"
      :key="e.id"
      :title="e.title"
      :subtitle="formatDate(e.at)"
      :icon="iconOf(e.kind)"
      color="primary"
    >
      <div class="mp-wallet-timeline__row">
        <div :class="['mp-wallet-timeline__amount', amountClass(e)]">
          {{ amountSign(e) }}{{ formatAmount(e.amount) }} ₽
        </div>
        <span class="mp-status-chip" :class="`mp-status-chip--${chipKindOf(e.kind)}`">
          {{ kindLabel[e.kind] }}
        </span>
        <span v-if="e.orderId" class="mp-status-chip mp-status-chip--neutral">
          № {{ e.orderId }}
        </span>
      </div>
      <div v-if="e.note" class="mp-wallet-timeline__note">{{ e.note }}</div>
    </q-timeline-entry>

    <q-timeline-entry v-if="!entries.length" subtitle="История пуста" title="Операций пока нет">
      <div class="mp-wallet-timeline__empty">
        Когда вы заказываете товар или получаете выплату — записи появятся здесь.
      </div>
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

type ChipKind = 'info' | 'success' | 'warning' | 'error' | 'neutral'

function chipKindOf(k: WalletEntryKind): ChipKind {
  return ({
    deposit:  'success',
    block:    'warning',
    unblock:  'neutral',
    charge:   'neutral',
    refund:   'success',
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
  if (e.kind === 'deposit' || e.kind === 'refund' || e.kind === 'payout') return 'mp-wallet-timeline__amount--positive'
  if (e.kind === 'charge') return 'mp-wallet-timeline__amount--negative'
  return ''
}

function formatAmount(v: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.abs(v))
}

function formatDate(v: string | Date): string {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped lang="scss">
.mp-wallet-timeline {
  &__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--mp-space-sm);
  }

  &__amount {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -.02em;
    color: var(--mp-on-surface);

    &--positive { color: var(--q-positive); }
    &--negative { color: var(--q-negative); }
  }

  &__note {
    font-size: 13px;
    color: var(--mp-on-surface-muted);
    margin-top: 4px;
  }

  &__empty {
    color: var(--mp-on-surface-muted);
  }
}
</style>
