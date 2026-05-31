<template>
  <BaseCard class="order-card" :class="`order-card--${order.status}`">
    <template #head>
      <div class="order-card__head">
        <div class="order-card__head-row">
          <div class="order-card__title">{{ order.title }}</div>
          <BaseBadge :variant="order.statusVariant" class="order-card__status">
            {{ order.statusLabel }}
          </BaseBadge>
        </div>
        <div class="order-card__sub">
          <span class="order-card__num">№&nbsp;{{ order.shortId ?? order.id }}</span>
          <span class="order-card__sep" aria-hidden="true">·</span>
          <span>{{ formatDate(order.createdAt) }}</span>
        </div>
      </div>
    </template>

    <div class="order-card__facts">
      <div class="order-card__fact">
        <div class="order-card__fact-label">Сумма</div>
        <div class="order-card__fact-value order-card__fact-value--money">{{ formatPrice(order.totalCost) }}</div>
      </div>
      <div class="order-card__fact">
        <div class="order-card__fact-label">Кол-во</div>
        <div class="order-card__fact-value">{{ order.units }} {{ order.unitLabel ?? 'ед.' }}</div>
      </div>
    </div>

    <div v-if="order.pvzName || order.pvz" class="order-card__pvz">
      <q-icon name="place" size="18px" class="order-card__pvz-icon" />
      <div class="order-card__pvz-text">
        <div v-if="order.pvzName" class="order-card__pvz-name">{{ order.pvzName }}</div>
        <div v-if="order.pvz" class="order-card__pvz-addr">{{ order.pvz }}</div>
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
import type { BaseBadgeVariant } from 'src/shared/ui/base'

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
  /** Card-status — управляет набором действий per-role (ACTIONS_PER_ROLE). */
  status: OrderStatus
  /** Человекочитаемая подпись доменного статуса для бейджа (из orderStatusDisplay). */
  statusLabel: string
  /** Вариант бейджа доменного статуса. */
  statusVariant: BaseBadgeVariant
  /** Доступна ли отмена заказчиком (только до акцепта поставщика). */
  cancellable?: boolean
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
  // Обзорный режим (например сводный заказ): без действий по умолчанию.
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'action', payload: { key: string; order: Order }): void
}>()

// Доменный статус (подпись + вариант бейджа) приходит готовым в модели
// (order.statusLabel / order.statusVariant) из orderStatusDisplay — карточка
// его не переводит, чтобы не было двух разных статусов на одном заказе.

// Per-role набор действий по умолчанию (slot actions перебивает). Заказчик
// (orderer) обрабатывается отдельно в actionsForRole — его действия зависят от
// доменного `cancellable`, а не от грубого card-status.
const ACTIONS_PER_ROLE: Record<Exclude<OrderRole, 'orderer'>, Record<OrderStatus, OrderAction[]>> = {
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
    // Отгрузка идёт не с карточки заказа, а на странице «Подготовка отгрузки»
    // (формирование партии по КУ). Здесь действий по оплаченному заказу нет.
    paid: [],
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

const actionsForRole = computed<OrderAction[]>(() => {
  if (props.readonly) return []
  const role = props.role
  // Заказчик: единственное действие — отмена, и только пока заказ отменяем
  // (до акцепта поставщика). Детальная страница («Открыть») — Story 4.6
  // follow-up; нерабочих кнопок не показываем.
  if (role === 'orderer') {
    return props.order.cancellable ? [{ key: 'cancel', label: 'Отменить', kind: 'danger' }] : []
  }
  return ACTIONS_PER_ROLE[role][props.order.status]
})

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

  // Шапка: заголовок и бейдж в одной строке, №·дата — отдельной строкой на всю
  // ширину (раньше мета-строка переносилась вокруг бейджа и «висла»).
  &__head {
    min-width: 0;
    width: 100%;
  }

  &__head-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__title {
    min-width: 0;
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    letter-spacing: var(--p-ls-h3, -0.01em);
    line-height: var(--p-lh-h3, 1.3);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__status {
    flex-shrink: 0;
    align-self: flex-start;
    white-space: nowrap;
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

  // Факты: Сумма — крупное число-герой, Кол-во — рядом. Flex-wrap, чтобы на
  // совсем узкой карточке встать в столбик, но обычно — одна строка из двух
  // коротких значений (не «накидано» по вертикали).
  &__facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-3, 12px) var(--p-6, 24px);
  }

  &__fact {
    min-width: 0;
  }

  &__fact-label {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: 2px;
  }

  &__fact-value {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);

    &--money {
      font-size: var(--p-fs-h2, 18px);
      font-weight: 700;
      letter-spacing: var(--p-ls-h2, -0.01em);
      font-feature-settings: 'tnum' 1;
    }
  }

  // ПВЗ — отдельный блок с иконкой: наименование КУ (основное) + адрес.
  &__pvz {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    margin-top: var(--p-4, 16px);
  }

  &__pvz-icon {
    color: var(--p-ink-3);
    flex-shrink: 0;
    margin-top: 1px;
  }

  &__pvz-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__pvz-name {
    font-size: var(--p-fs-body-sm, 13px);
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
}
</style>
