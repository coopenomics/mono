<template>
  <BaseCard class="order-card" :class="`order-card--${order.status}`">
    <template #head>
      <div class="order-card__head-main">
        <div class="order-card__title">{{ order.title }}</div>
        <div class="order-card__sub">
          <span class="order-card__num">№&nbsp;{{ order.shortId ?? order.id }}</span>
          <span class="order-card__sep" aria-hidden="true">·</span>
          <span>{{ formatDate(order.createdAt) }}</span>
        </div>
      </div>
    </template>

    <template #actions>
      <BaseBadge :variant="statusVariant">{{ statusLabel }}</BaseBadge>
    </template>

    <div class="order-card__meta">
      <div class="order-card__meta-item">
        <div class="order-card__meta-label">Кол-во</div>
        <div class="order-card__meta-value">{{ order.units }} {{ order.unitLabel ?? 'ед.' }}</div>
      </div>
      <div class="order-card__meta-item">
        <div class="order-card__meta-label">Сумма</div>
        <div class="order-card__meta-value order-card__meta-value--strong">{{ formatPrice(order.totalCost) }}</div>
      </div>
      <div v-if="order.pvzName || order.pvz" class="order-card__meta-item order-card__meta-item--wide">
        <div class="order-card__meta-label">Пункт выдачи</div>
        <div class="order-card__pvz">
          <q-icon name="place" size="16px" class="order-card__pvz-icon" />
          <span class="order-card__pvz-text">
            <span v-if="order.pvzName" class="order-card__pvz-name">{{ order.pvzName }}</span>
            <span v-if="order.pvz" class="order-card__pvz-addr">{{ order.pvz }}</span>
          </span>
        </div>
      </div>
    </div>

    <div v-if="actionsForRole.length || $slots.actions" class="order-card__foot">
      <slot name="actions" :order="order" :role="role">
        <BaseButton
          v-for="a in actionsForRole"
          :key="a.key"
          :variant="actionVariant(a)"
          size="sm"
          @click="emit('action', { key: a.key, order })"
        >
          {{ a.label }}
        </BaseButton>
      </slot>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { BaseCard, BaseBadge, BaseButton } from 'src/shared/ui/base'

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
  /** Наименование пункта выдачи (кооперативного участка) — основная строка ПВЗ. */
  pvzName?: string
  /** Адрес пункта выдачи — вторичная строка под наименованием. */
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

type StatusVariant = 'info' | 'pos' | 'warn' | 'neg' | 'neutral'

const STATUS_MAP: Record<OrderStatus, { label: string; variant: StatusVariant }> = {
  draft:             { label: 'Черновик',       variant: 'neutral' },
  placed:            { label: 'Размещён',       variant: 'info'    },
  paid:              { label: 'Оплачен',        variant: 'pos'     },
  'in-delivery':     { label: 'В доставке',     variant: 'warn'    },
  'arrived-at-pvz':  { label: 'Прибыл в ПВЗ',   variant: 'info'    },
  'ready-to-issue':  { label: 'Готов к выдаче', variant: 'info'    },
  issued:            { label: 'Выдан',          variant: 'pos'     },
  cancelled:         { label: 'Отменён',        variant: 'neg'     },
  dispute:           { label: 'Претензия',      variant: 'neg'     },
  returned:          { label: 'Возвращён',      variant: 'neutral' },
}

const statusLabel = computed(() => STATUS_MAP[props.order.status].label)
const statusVariant = computed<StatusVariant>(() => STATUS_MAP[props.order.status].variant)

// Per-role набор действий по умолчанию (slot actions перебивает).
const ACTIONS_PER_ROLE: Record<OrderRole, Record<OrderStatus, OrderAction[]>> = {
  orderer: {
    draft: [{ key: 'open', label: 'Открыть' }, { key: 'cancel', label: 'Удалить', kind: 'flat' }],
    // Story 4.4: до акцепта поставщика заказчик может отменить Order
    // (C++ marketplace::cancelorder — guard status==ACTIVE). После
    // acceptorder отмена недоступна (поставщик принял обязательство).
    placed: [{ key: 'open', label: 'Открыть' }, { key: 'cancel', label: 'Отменить', kind: 'danger' }],
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
    // Story 4.5: placed = ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL для individual
    // cycle_type или unassigned ACTIVE для open_subscription пула. На batch
    // (time/volume) поставщик решает по консолидированной заявке отдельным
    // экраном «Консолидированные заявки», не в OrderCard. Decline требует
    // reason — обрабатывается parent'ом через confirm-dialog.
    draft: [], placed: [
      { key: 'accept', label: 'Принять', kind: 'primary' },
      { key: 'decline', label: 'Отказать', kind: 'danger' },
    ],
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

function actionVariant(a: OrderAction): 'primary' | 'danger' | 'ghost' {
  if (a.kind === 'primary') return 'primary'
  if (a.kind === 'danger') return 'danger'
  return 'ghost'
}

function formatDate(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(v: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 }).format(v) + ' ₽'
}
</script>

<style scoped lang="scss">
.order-card {
  // Тонкая граница и плоскость — из BaseCard (канон-инвариант: без теней).
  &__head-main {
    min-width: 0;
  }

  &__title {
    font-size: var(--p-fs-h3, 16px);
    font-weight: 600;
    letter-spacing: var(--p-ls-h3, -0.01em);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-1, 4px) var(--p-2, 8px);
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__num {
    font-family: var(--p-mono);
    letter-spacing: 0;
  }

  &__sep {
    color: var(--p-ink-3);
  }

  &__meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--p-3, 12px) var(--p-4, 16px);
  }

  &__meta-item--wide {
    grid-column: 1 / -1;
  }

  &__meta-label {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: 2px;
  }

  &__meta-value {
    font-size: var(--p-fs-body, 15px);
    color: var(--p-ink);

    &--strong {
      font-weight: 600;
    }

  }

  &__pvz {
    display: flex;
    align-items: flex-start;
    gap: var(--p-1, 4px);
  }

  &__pvz-icon {
    color: var(--p-ink-3);
    flex-shrink: 0;
    margin-top: 2px;
  }

  &__pvz-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__pvz-name {
    font-size: var(--p-fs-body-sm, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__pvz-addr {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    margin-top: var(--p-4, 16px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  @media (max-width: 480px) {
    &__meta {
      grid-template-columns: 1fr 1fr;
    }
    &__meta-item--wide {
      grid-column: 1 / -1;
    }
  }
}
</style>
