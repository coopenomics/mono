<template>
  <div class="mp-wallet-timeline-section">
    <div class="text-h5 q-mb-md">WalletTimeline · Story 10.2.2 · UX-DR8</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Лента движений кошелька пайщика: пополнения, блокировки под заказ, списания
      при выдаче, возвраты при гарантии. 6 типов операций. Используется в эпиках
      4 (Заказ и блокировка), 9 (Склад и отчётность).
    </div>

    <div class="row q-gutter-md q-mb-lg">
      <q-btn-toggle
        v-model="filter"
        :options="filters"
        unelevated
        toggle-color="primary"
        dense
      />
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-7">
        <div class="text-subtitle1 q-mb-sm">Обычный режим</div>
        <WalletTimeline :entries="filtered" layout="comfortable" />
      </div>
      <div class="col-12 col-md-5">
        <div class="text-subtitle1 q-mb-sm">Empty state</div>
        <WalletTimeline :entries="[]" layout="comfortable" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { WalletTimeline, type WalletEntry, type WalletEntryKind } from 'src/widgets/Marketplace/WalletTimeline'

const filter = ref<'all' | WalletEntryKind>('all')
const filters = [
  { label: 'Все',          value: 'all' },
  { label: 'Пополнение',   value: 'deposit' },
  { label: 'Блокировка',   value: 'block' },
  { label: 'Списание',     value: 'charge' },
  { label: 'Возврат',      value: 'refund' },
  { label: 'Выплата',      value: 'payout' },
]

const entries: WalletEntry[] = [
  { id: 1, kind: 'deposit', amount: 5000, title: 'Пополнение через СБП', at: '2026-05-14T10:00:00Z', note: 'СБП · Сбербанк' },
  { id: 2, kind: 'block', amount: 3500, title: 'Блокировка под заказ', at: '2026-05-14T11:23:00Z', orderId: 1234 },
  { id: 3, kind: 'charge', amount: 3500, title: 'Списание при выдаче', at: '2026-05-15T14:05:00Z', orderId: 1234, note: 'Двойная подпись подтверждена оператором ПВЗ' },
  { id: 4, kind: 'block', amount: 1800, title: 'Блокировка под заказ', at: '2026-05-15T16:40:00Z', orderId: 1235 },
  { id: 5, kind: 'unblock', amount: 1800, title: 'Разблокировка (отмена заказа)', at: '2026-05-15T17:00:00Z', orderId: 1235 },
  { id: 6, kind: 'refund', amount: 600, title: 'Гарантийный возврат', at: '2026-05-16T09:00:00Z', orderId: 1230, note: 'Compensating-forward по решению совета' },
  { id: 7, kind: 'payout', amount: 12500, title: 'Выплата поставщику', at: '2026-05-16T15:30:00Z', note: 'Партия молока 50 л × 250 ₽' },
]

const filtered = computed(() =>
  filter.value === 'all' ? entries : entries.filter((e) => e.kind === filter.value)
)
</script>
