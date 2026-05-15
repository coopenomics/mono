<template>
  <q-card flat bordered class="mp-order-card" :class="cardClasses">
    <q-card-section class="mp-order-card__header">
      <div class="row items-center q-gutter-sm">
        <div class="text-subtitle1 mp-order-card__id">№ {{ order.shortId ?? order.id }}</div>
        <q-space />
        <q-badge :color="statusColor" class="mp-status-badge mp-order-card__status">
          {{ statusLabel }}
        </q-badge>
      </div>
      <div class="text-caption text-grey-7 q-mt-xs">{{ formatDate(order.createdAt) }}</div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-body1 q-mb-sm">{{ order.title }}</div>

      <div class="mp-order-card__meta">
        <div class="mp-order-card__meta-item">
          <div class="mp-order-card__meta-label">Кол-во</div>
          <div class="mp-order-card__meta-value">{{ order.units }} {{ order.unitLabel ?? 'ед.' }}</div>
        </div>
        <div class="mp-order-card__meta-item">
          <div class="mp-order-card__meta-label">Сумма</div>
          <div class="mp-order-card__meta-value">{{ formatPrice(order.totalCost) }}</div>
        </div>
        <div v-if="order.pvz" class="mp-order-card__meta-item mp-order-card__meta-item--wide">
          <div class="mp-order-card__meta-label">ПВЗ</div>
          <div class="mp-order-card__meta-value mp-order-card__meta-value--muted">{{ order.pvz }}</div>
        </div>
      </div>
    </q-card-section>

    <q-card-actions v-if="actionsForRole.length || $slots.actions" align="right" class="mp-order-card__actions">
      <slot name="actions" :order="order" :role="role">
        <q-btn
          v-for="a in actionsForRole"
          :key="a.key"
          :flat="a.kind === 'flat'"
          :unelevated="a.kind === 'primary'"
          :color="a.kind === 'primary' ? 'primary' : a.kind === 'danger' ? 'negative' : undefined"
          :label="a.label"
          dense
          @click="emit('action', { key: a.key, order })"
        />
      </slot>
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

export type OrderStatus =
  | 'draft'
  | 'placed'
  | 'paid'
  | 'in-delivery'
  | 'arrived-at-pvz'
  | 'ready-to-issue'
  | 'issued'
  | 'cancelled'
  | 'dispute'
  | 'returned'

export type OrderRole = 'orderer' | 'offerer' | 'operator' | 'admin'

export interface Order {
  id: string | number
  shortId?: string
  title: string
  units: number
  unitLabel?: string
  totalCost: number
  status: OrderStatus
  createdAt: string | Date
  pvz?: string
}

interface OrderAction {
  key: string
  label: string
  kind?: 'primary' | 'flat' | 'danger'
}

const props = defineProps({
  order: { type: Object as PropType<Order>, required: true },
  role:  { type: String as PropType<OrderRole>, default: 'orderer' },
})

const emit = defineEmits<{
  (e: 'action', payload: { key: string; order: Order }): void
}>()

const STATUS_MAP: Record<OrderStatus, { label: string; color: string }> = {
  draft:             { label: 'Черновик',            color: 'grey'     },
  placed:            { label: 'Размещён',            color: 'info'     },
  paid:              { label: 'Оплачен',             color: 'positive' },
  'in-delivery':     { label: 'В доставке',          color: 'warning'  },
  'arrived-at-pvz':  { label: 'Прибыл в ПВЗ',        color: 'orange'   },
  'ready-to-issue':  { label: 'Готов к выдаче',      color: 'primary'  },
  issued:            { label: 'Выдан',               color: 'positive' },
  cancelled:         { label: 'Отменён',             color: 'negative' },
  dispute:           { label: 'Претензия',           color: 'negative' },
  returned:          { label: 'Возвращён',           color: 'grey-7'   },
}

const statusLabel = computed(() => STATUS_MAP[props.order.status].label)
const statusColor = computed(() => STATUS_MAP[props.order.status].color)
const cardClasses = computed(() => `mp-order-card--${props.order.status}`)

// Per-role набор действий по умолчанию (slot actions перебивает).
const ACTIONS_PER_ROLE: Record<OrderRole, Record<OrderStatus, OrderAction[]>> = {
  orderer: {
    draft: [{ key: 'open', label: 'Открыть' }, { key: 'cancel', label: 'Удалить', kind: 'flat' }],
    placed: [{ key: 'open', label: 'Открыть' }],
    paid: [{ key: 'open', label: 'Открыть' }],
    'in-delivery': [{ key: 'open', label: 'Открыть' }],
    'arrived-at-pvz': [{ key: 'open', label: 'Подробнее', kind: 'primary' }],
    'ready-to-issue': [{ key: 'open', label: 'Получить', kind: 'primary' }],
    issued: [{ key: 'open', label: 'Открыть' }],
    cancelled: [{ key: 'open', label: 'Открыть' }],
    dispute: [{ key: 'open', label: 'Открыть' }],
    returned: [{ key: 'open', label: 'Открыть' }],
  },
  offerer: {
    draft: [], placed: [{ key: 'accept', label: 'Принять', kind: 'primary' }],
    paid: [{ key: 'ship', label: 'Отгрузить', kind: 'primary' }],
    'in-delivery': [], 'arrived-at-pvz': [], 'ready-to-issue': [],
    issued: [], cancelled: [], dispute: [{ key: 'reply', label: 'Ответить', kind: 'primary' }],
    returned: [],
  },
  operator: {
    draft: [], placed: [], paid: [],
    'in-delivery': [{ key: 'mark-arrived', label: 'Принять на ПВЗ', kind: 'primary' }],
    'arrived-at-pvz': [{ key: 'issue', label: 'Выдать', kind: 'primary' }],
    'ready-to-issue': [{ key: 'issue', label: 'Выдать', kind: 'primary' }],
    issued: [], cancelled: [], dispute: [], returned: [{ key: 'process-return', label: 'Принять возврат', kind: 'primary' }],
  },
  admin: {
    draft: [{ key: 'open', label: 'Открыть' }],
    placed: [{ key: 'open', label: 'Открыть' }],
    paid: [{ key: 'open', label: 'Открыть' }],
    'in-delivery': [{ key: 'open', label: 'Открыть' }],
    'arrived-at-pvz': [{ key: 'open', label: 'Открыть' }],
    'ready-to-issue': [{ key: 'open', label: 'Открыть' }],
    issued: [{ key: 'open', label: 'Открыть' }],
    cancelled: [{ key: 'open', label: 'Открыть' }],
    dispute: [{ key: 'open', label: 'Открыть' }, { key: 'arbitrate', label: 'Арбитраж', kind: 'primary' }],
    returned: [{ key: 'open', label: 'Открыть' }],
  },
}

const actionsForRole = computed<OrderAction[]>(
  () => ACTIONS_PER_ROLE[props.role]?.[props.order.status] ?? []
)

function formatDate(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(v: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 }).format(v) + ' ₽'
}
</script>

<style scoped lang="scss">
.mp-order-card {
  border-radius: var(--mp-radius-md);

  &__header { padding-bottom: var(--mp-space-sm); }
  &__id { font-weight: 600; letter-spacing: -.01em; }

  &__meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--mp-space-md);
  }

  &__meta-item--wide { grid-column: span 2; }

  &__meta-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--mp-on-surface-muted);
    margin-bottom: 2px;
  }

  &__meta-value {
    font-size: 15px;
    color: var(--mp-on-surface);

    &--muted { color: var(--mp-on-surface-muted); font-size: 13px; }
  }

  // На очень узких — meta стэк, заголовок и статус в одну колонку
  @media (max-width: 480px) {
    &__meta {
      grid-template-columns: 1fr 1fr;
    }
    &__meta-item--wide { grid-column: 1 / -1; }
  }

  // На operator-POS — больше отступы и крупнее текст
  .mp-role-operator & {
    font-size: 1.05rem;
    .mp-order-card__meta-value { font-size: 17px; }
  }
}
</style>
