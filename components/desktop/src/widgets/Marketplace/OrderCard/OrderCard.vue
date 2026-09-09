<template>
  <!-- Строка списка «Мои заказы»: сетка из двух ярусов, а не один длинный
       ряд колонок. Верхний ярус — «что это»: миниатюра, название, номер с
       датой и состояние заказа. Нижний — «сколько и куда»: количество, сумма и
       пункт выдачи равными ячейками. Прежний одноярусный ряд при заужении
       переносил колонки по одной, и карточка расползалась: сумма липла к
       количеству, а пункт выдачи оставался сиротой внизу (жалоба 2026-09-09). -->
  <div
    v-if="layout === 'row'"
    class="order-row"
    :class="[`order-row--${order.status}`, { 'order-row--openable': openable }]"
    @click="onCardClick"
  >
    <div class="order-row__head">
      <div class="order-row__thumb">
        <!-- fit=contain: товар виден целиком. Обрезка по квадрату резала
             вертикальные снимки — от бутылки оставалась середина. -->
        <q-img v-if="order.imageUrl" :src="order.imageUrl" ratio="1" fit="contain" class="order-row__thumb-img" />
        <div v-else class="order-row__thumb-empty">
          <q-icon name="image" size="20px" />
        </div>
      </div>

      <div class="order-row__ident">
        <div class="order-row__title">{{ order.title }}</div>
        <div class="order-row__sub">
          <span class="order-row__num">№&nbsp;{{ order.shortId ?? order.id }}</span>
          <span class="order-row__sep" aria-hidden="true">·</span>
          <span>{{ formatDate(order.createdAt) }}</span>
        </div>
      </div>

      <div class="order-row__status-col">
        <BaseBadge :variant="order.statusVariant" class="order-row__status">
          {{ order.statusLabel }}
        </BaseBadge>
      </div>
    </div>

    <!-- Сбор партии — отдельной строкой во всю ширину под шапкой: полоса и
         подпись читаются вместе, не жмутся к бейджу состояния. -->
    <div v-if="order.progress !== undefined" class="order-row__progress">
      <q-linear-progress
        class="order-row__progress-bar"
        :value="order.progress"
        rounded
        size="4px"
        color="primary"
        track-color="grey-3"
      />
      <div class="order-row__progress-label">
        коллективный заказ · {{ Math.round(order.progress * 100) }}%
        <q-icon name="help_outline" size="12px" class="order-row__progress-help">
          <q-tooltip>Заказ копится вместе с другими пайщиками до минимального объёма поставки на этот пункт выдачи.</q-tooltip>
        </q-icon>
      </div>
    </div>

    <div class="order-row__facts">
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
        class="order-row__fact order-row__fact--pvz"
        :class="{ 'order-row__fact--mappable': hasMap }"
        @click.stop="hasMap && emit('map', order)"
      >
        <div class="order-row__fact-label">Пункт выдачи</div>
        <div class="order-row__pvz">
          <q-icon name="place" size="16px" class="order-row__pvz-icon" />
          <div class="order-row__pvz-text">
            <div v-if="order.pvzName" class="order-row__pvz-name">{{ order.pvzName }}</div>
            <div v-if="order.pvz" class="order-row__pvz-addr">{{ order.pvz }}</div>
          </div>
          <q-icon v-if="hasMap" name="map" size="14px" class="order-row__pvz-map" />
        </div>
      </div>
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

    <div v-if="order.progress !== undefined" class="order-card__progress">
      <div class="order-card__progress-label">
        коллективный заказ · {{ Math.round(order.progress * 100) }}%
        <q-icon name="help_outline" size="14px" class="order-card__progress-help">
          <q-tooltip>Заказ копится вместе с другими пайщиками до минимального объёма поставки на этот пункт выдачи.</q-tooltip>
        </q-icon>
      </div>
      <q-linear-progress
        class="order-card__progress-bar"
        :value="order.progress"
        rounded
        size="6px"
        color="primary"
        track-color="grey-3"
      />
    </div>

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
import type { OrderStatus, OrderRole, Order } from './OrderCard.types'

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

// Per-role набор действий по умолчанию (slot actions перебивает). У заказчика
// (orderer) действий в карточке нет — отмена заказа живёт только на детальной
// странице заказа (OrdererOrderDetailPage), не дублируется в списке.
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
  // Заказчик: действий в карточке нет — отмена только на детальной странице
  // заказа. Подпись получения — у стойки ПВЗ в гейте «подпись на месте»
  // (единый путь выдачи). Полную карточку открывает клик по телу (openable).
  if (role === 'orderer') return []
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

  // Сборка партии — узкая полоска (не во всю ширину карточки), только пока
  // заказ ещё копится к минимальному объёму поставки.
  &__progress {
    max-width: 220px;
    margin-top: var(--p-1, 4px);
  }

  &__progress-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: 4px;
  }

  &__progress-help {
    color: var(--p-ink-3);
    cursor: help;
  }

  &__progress-bar {
    border-radius: var(--p-r-sm, 8px);
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

// Строчная раскладка (layout="row"): карточка списка «Мои заказы» из двух
// ярусов. Верхний — «что это»: миниатюра, название, номер с датой и состояние.
// Нижний — «сколько и куда»: количество, сумма и пункт выдачи равными ячейками
// с подписями. Так карточка держит форму на любой ширине: колонки не разъезжаются
// по одной, а перестраиваются целыми ярусами.
.order-row {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
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

  // Верхний ярус: миниатюра слева, рядом с ней — название и номер, состояние
  // прижато вправо. На узком экране состояние встаёт под номером, оставаясь
  // рядом с миниатюрой (просьба владельца 2026-09-09).
  &__head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'thumb ident status';
    align-items: center;
    gap: var(--p-2, 8px) var(--p-4, 16px);
  }

  // Миниатюра товара — фиксированный квадрат слева, как в корзине/каталоге.
  &__thumb {
    grid-area: thumb;
    width: 56px;
    height: 56px;
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
    background: var(--p-surface-2);
    align-self: start;
  }

  &__thumb-img {
    width: 100%;
    height: 100%;
  }

  &__thumb-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-ink-3);
  }

  &__ident {
    grid-area: ident;
    min-width: 0;
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

  &__status-col {
    grid-area: status;
    display: flex;
    justify-content: flex-end;
    min-width: 0;
  }

  &__status {
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

  // Сбор партии — свой ярус между шапкой и цифрами: полоса и подпись под ней
  // читаются как одно целое.
  &__progress {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__progress-bar {
    border-radius: var(--p-r-sm, 8px);
  }

  &__progress-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-eyebrow, 11px);
    color: var(--p-ink-3);
  }

  &__progress-help {
    color: var(--p-ink-3);
    cursor: help;
  }

  // Нижний ярус: количество, сумма и пункт выдачи — равноправные ячейки с
  // подписями. Раньше пункт выдачи шёл отдельной колонкой без подписи и на
  // узком экране оставался внизу сам по себе, а сумма липла к количеству.
  &__facts {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1.4fr);
    gap: var(--p-3, 12px) var(--p-5, 20px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  &__fact {
    min-width: 0;
  }

  // Пункт выдачи с координатами открывает карту «куда ехать». Подложки под
  // наведение нет намеренно: она требовала бы отрицательных отступов внутри
  // карточки — того самого приёма, который давал горизонтальную прокрутку.
  &__fact--mappable {
    cursor: pointer;

    &:hover .order-row__pvz-addr,
    &:hover .order-row__pvz-map {
      color: var(--p-primary-hover);
    }
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
      font-size: var(--p-fs-h3, 15px);
      font-weight: 700;
      letter-spacing: var(--p-ls-h3, -0.01em);
      font-feature-settings: 'tnum' 1;
    }
  }

  &__fee-note {
    font-size: var(--p-fs-body-sm, 12px);
    color: var(--p-ink-3);
    margin-top: 2px;
  }

  &__pvz {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    min-width: 0;
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

  &__fact--mappable &__pvz-addr {
    color: var(--p-primary);
  }

  &__pvz-map {
    color: var(--p-primary);
    flex-shrink: 0;
    align-self: center;
    margin-left: auto;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  // Узкий экран: состояние переезжает под номер заказа — рядом с миниатюрой,
  // а не отдельной строкой снизу. Цифры внизу становятся в две колонки, пункт
  // выдачи занимает строку целиком: адрес длинный, в трети ширины он рвётся.
  @media (max-width: 700px) {
    &__head {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas:
        'thumb ident'
        'thumb status';
      align-items: start;
    }

    &__status-col {
      justify-content: flex-start;
    }

    &__facts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &__fact--pvz {
      grid-column: 1 / -1;
    }

    &__actions {
      justify-content: flex-start;
    }
  }
}
</style>
