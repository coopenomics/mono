<template>
  <div class="mp-order-card-section">
    <div class="text-h5 q-mb-md">OrderCard · Story 10.2.3 · UX-DR9</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Карточка заказа со статусом жизненного цикла и actions, зависящими от роли стола.
      На <code>orderer</code> — «Получить» когда готов к выдаче; на <code>operator</code> —
      «Принять на ПВЗ» / «Выдать»; на <code>admin</code> — «Арбитраж» при претензии.
    </div>

    <div class="row q-gutter-md q-mb-lg items-center">
      <q-select
        v-model="role"
        :options="roles"
        emit-value
        map-options
        dense
        outlined
        label="Симуляция: actions для роли"
        style="min-width: 220px"
      />
    </div>

    <div class="text-h6 q-mb-sm">Все статусы (per-роль actions)</div>
    <div class="row q-col-gutter-md">
      <div v-for="o in orders" :key="o.id" class="col-12 col-sm-6 col-md-4">
        <OrderCard :order="o" :role="role" @action="onAction" />
      </div>
    </div>

    <q-banner v-if="lastAction" class="mp-event-banner q-mt-lg" rounded>
      Action: <strong>{{ lastAction.key }}</strong> на заказе
      <strong>#{{ lastAction.order.shortId ?? lastAction.order.id }}</strong>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { OrderCard, type Order, type OrderRole, type OrderStatus } from 'src/widgets/Marketplace/OrderCard'

const role = ref<OrderRole>('orderer')
const roles = [
  { value: 'orderer',  label: 'Заказчик' },
  { value: 'offerer',  label: 'Поставщик' },
  { value: 'operator', label: 'Оператор ПВЗ' },
  { value: 'admin',    label: 'Админ' },
]

const lastAction = ref<{ key: string; order: Order } | null>(null)
function onAction(payload: { key: string; order: Order }) { lastAction.value = payload }

const allStatuses: OrderStatus[] = [
  'draft', 'placed', 'paid', 'in-delivery', 'arrived-at-pvz',
  'ready-to-issue', 'issued', 'cancelled', 'dispute', 'returned',
]

const orders: Order[] = allStatuses.map((s, i) => ({
  id: 1000 + i,
  shortId: `MP-${1000 + i}`,
  title: 'Картофель «Невский» — 10 кг',
  units: 10,
  unitLabel: 'кг',
  totalCost: 3500,
  status: s,
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  pvz: i % 2 === 0 ? 'ПВЗ Восход (Молодёжная, 12)' : undefined,
}))
</script>
