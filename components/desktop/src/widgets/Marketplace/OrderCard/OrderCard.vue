<template>
  <!-- Горизонтальная строка (списки вроде «Мои заказы»): вся сводка заказа в
       один ряд на всю ширину — так порядок сверху вниз читается однозначно,
       без «квадратиков» в сетке, где непонятно, что новее. -->
  <div
    v-if="layout === 'row'"
    class="order-row"
    :class="[`order-row--${order.status}`, { 'order-row--openable': openable }]"
    @click="onCardClick"
  >
    <div class="order-row__main">
      <div class="order-row__title-line">
        <span class="order-row__title">{{ order.title }}</span>
        <BaseBadge :variant="order.statusVariant" class="order-row__status">
          {{ order.statusLabel }}
        </BaseBadge>
      </div>
      <div class="order-row__sub">
        <span class="order-row__num">№&nbsp;{{ order.shortId ?? order.id }}</span>
        <span class="order-row__sep" aria-hidden="true">·</span>
        <span>{{ formatDate(order.createdAt) }}</span>
      </div>
    </div>

    <div class="order-row__fact">
      <div class="order-row__fact-label">Кол-во</div>
      <div class="order-row__fact-value">{{ order.units }}×{{ order.unitLabel ?? 'ед.' }}</div>
    </div>

    <div class="order-row__fact">
      <div class="order-row__fact-label">Сумма</div>
      <div class="order-row__fact-value order-row__fact-value--money">{{ formatPrice(order.totalCost) }}</div>
      <div v-if="order.feeNote" class="order-row__fee-note">{{ order.feeNote }}</div>
    </div>

    <div
      v-if="order.pvzName || order.pvz"
      class="order-row__pvz"
      :class="{ 'order-row__pvz--mappable': hasMap }"
      @click.stop="hasMap && emit('map', order)"
    >
      <q-icon name="place" size="16px" class="order-row__pvz-icon" />
      <div class="order-row__pvz-text">
        <div v-if="order.pvzName" class="order-row__pvz-name">{{ order.pvzName }}</div>
        <div v-if="order.pvz" class="order-row__pvz-addr">{{ order.pvz }}</div>
      </div>
      <q-icon v-if="hasMap" name="map" size="14px" class="order-row__pvz-map" />
    </div>

    <div v-if="actionsForRole.length || $slots.actions" class="order-row__actions" @click.stop>
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
  </div>

  <BaseCard
    v-else
    class="order-card"
    :class="[`order-card--${order.status}`, { 'order-card--openable': openable }]"
    @click="onCardClick"
  >
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
        <div v-if="order.feeNote" class="order-card__fee-note">{{ order.feeNote }}</div>
      </div>
      <div class="order-card__fact">
        <div class="order-card__fact-label">Кол-во</div>
        <div class="order-card__fact-value">{{ order.units }}×{{ order.unitLabel ?? 'ед.' }}</div>
      </div>
    </div>

    <div
      v-if="order.pvzName || order.pvz"
      class="order-card__pvz"
      :class="{ 'order-card__pvz--mappable': hasMap }"
      @click.stop="hasMap && emit('map', order)"
    >
      <q-icon name="place" size="18px" class="order-card__pvz-icon" />
      <div class="order-card__pvz-text">
        <div v-if="order.pvzName" class="order-card__pvz-name">{{ order.pvzName }}</div>
        <div v-if="order.pvz" class="order-card__pvz-addr">{{ order.pvz }}</div>
      </div>
      <q-icon v-if="hasMap" name="map" size="16px" class="order-card__pvz-map" />
    </div>

    <div v-if="actionsForRole.length || $slots.actions" class="order-card__foot" @click.stop>
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
  /**
   * Пояснение под суммой (requirement b6) — например «С учётом взноса
   * пайщика: 1 300 ₽» на столе поставщика, где `totalCost` — его
   * себестоимость без взноса. Заказчику не показывается — там `totalCost`
   * уже включает взнос.
   */
  feeNote?: string
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
  /** Широта ПВЗ — если задана вместе с pvzLng, блок адреса открывает карту. */
  pvzLat?: number
  /** Долгота ПВЗ. */
  pvzLng?: number
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
  // Карточка кликабельна: клик по телу открывает детальную страницу заказа
  // (эмитит `open`). Кнопки действий клик не перехватывают (@click.stop).
  openable: { type: Boolean, default: false },
  // 'card' — плитка в сетке (по умолчанию); 'row' — строка на всю ширину
  // списка (см. «Мои заказы») — та же модель и действия, другая раскладка.
  layout: { type: String as PropType<'card' | 'row'>, default: 'card' },
})

const emit = defineEmits<{
  (e: 'action', payload: { key: string; order: Order }): void
  (e: 'open', order: Order): void
  (e: 'map', order: Order): void
}>()

// ПВЗ кликабелен (открывает карту «куда ехать»), только когда есть координаты.
const hasMap = computed(
  () => typeof props.order.pvzLat === 'number' && typeof props.order.pvzLng === 'number',
)

function onCardClick(): void {
  if (props.openable) emit('open', props.order)
}

// Доменный статус (подпись + вариант бейджа) приходит готовым в модели
// (order.statusLabel / order.statusVariant) из orderStatusDisplay — карточка
// его не переводит, чтобы не было двух разных статусов на одном заказе.

// Per-role набор действий по умолчанию (slot actions перебивает). Заказчик
// (orderer) обрабатывается отдельно в actionsForRole — его действия зависят от
// доменного `cancellable`, а не от грубого card-status.
const ACTIONS_PER_ROLE: Record<Exclude<OrderRole, 'orderer'>, Record<OrderStatus, OrderAction[]>> = {
  offerer: {
    // Story 4.5: placed = ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL для individual
    // cycle_type или unassigned ACTIVE для пула коллективной закупки. По
    // коллективной партии поставщик решает по консолидированной заявке отдельным
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
  // Заказчик: «Отменить», пока заказ отменяем (до акцепта поставщика). Подпись
  // получения — у стойки ПВЗ в гейте «подпись на месте» (единый путь выдачи),
  // в карточке заказа её нет. Полную карточку открывает клик по телу (openable).
  if (role === 'orderer') {
    const actions: OrderAction[] = []
    if (props.order.cancellable) actions.push({ key: 'cancel', label: 'Отменить', kind: 'danger' })
    return actions
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

  // Кликабельная карточка: тело ведёт на детальную страницу заказа. Без теней
  // (канон-инвариант) — обратная связь через цвет границы.
  &--openable {
    cursor: pointer;
    transition: border-color 0.15s ease;

    &:hover {
      border-color: var(--p-ink-3);
    }
  }

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

  &__fee-note {
    font-size: var(--p-fs-body-sm, 12px);
    color: var(--p-ink-3);
    margin-top: 2px;
  }

  // ПВЗ — отдельный блок с иконкой: наименование КУ (основное) + адрес.
  &__pvz {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    margin-top: var(--p-4, 16px);

    // С координатами — кликабельный: открывает карту «куда ехать».
    &--mappable {
      cursor: pointer;
      border-radius: var(--p-r-sm, 8px);
      margin-left: calc(-1 * var(--p-2, 8px));
      margin-right: calc(-1 * var(--p-2, 8px));
      padding: var(--p-2, 8px);
      margin-top: var(--p-2, 8px);
      transition: background 0.15s ease;

      &:hover {
        background: var(--p-surface-2);
      }

      .order-card__pvz-addr {
        color: var(--p-primary);
      }
    }
  }

  &__pvz-map {
    margin-left: auto;
    color: var(--p-primary);
    flex-shrink: 0;
    align-self: center;
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

// Строчная раскладка (layout="row"): вся сводка заказа в один ряд на всю
// ширину списка. Тот же hairline-border/no-shadow инвариант, что и у карточки.
.order-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3, 12px) var(--p-6, 24px);
  padding: var(--p-4, 16px) var(--p-5, 20px);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface);

  &--openable {
    cursor: pointer;
    transition: border-color 0.15s ease;

    &:hover {
      border-color: var(--p-ink-3);
    }
  }

  // Заголовок + номер/дата — тянется, отдаёт место остальным колонкам первым.
  &__main {
    flex: 1 1 260px;
    min-width: 0;
  }

  &__title-line {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
  }

  &__title {
    min-width: 0;
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    letter-spacing: var(--p-ls-h3, -0.01em);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__status {
    flex-shrink: 0;
    margin-left: auto;
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

  // Кол-во/Сумма — компактные колонки фиксированной ширины, не тянутся.
  &__fact {
    flex: 0 0 auto;
    min-width: 88px;
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
    white-space: nowrap;

    &--money {
      font-weight: 700;
      font-feature-settings: 'tnum' 1;
    }
  }

  &__fee-note {
    font-size: var(--p-fs-body-sm, 12px);
    color: var(--p-ink-3);
    margin-top: 2px;
    white-space: nowrap;
  }

  // ПВЗ — своя колонка, тянется меньше, чем заголовок, но больше фактов.
  &__pvz {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    flex: 1 1 200px;
    min-width: 0;

    &--mappable {
      cursor: pointer;
      border-radius: var(--p-r-sm, 8px);
      margin: calc(-1 * var(--p-2, 8px));
      padding: var(--p-2, 8px);
      transition: background 0.15s ease;

      &:hover {
        background: var(--p-surface-2);
      }

      .order-row__pvz-addr {
        color: var(--p-primary);
      }
    }
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

  &__pvz-map {
    color: var(--p-primary);
    flex-shrink: 0;
    align-self: center;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    flex: 0 0 auto;
    margin-left: auto;
  }
}
</style>
