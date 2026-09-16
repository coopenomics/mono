<template>
  <!-- Строка списка «Мои заказы». Четыре зоны, каждая отвечает на свой
       вопрос: миниатюра с названием, номером и пунктом выдачи — «что и
       куда»; сумма с количеством под ней — «сколько»; бейдж с полосой сбора
       партии — «в каком состоянии». На широком экране зоны стоят в ряд, на
       узком — те же зоны перестраиваются в два яруса: состояние встаёт под
       номером, рядом с миниатюрой, а сумма с количеством уходят в нижнюю
       строку-чек. Разметка одна, раскладку меняет только сетка. -->
  <div
    v-if="layout === 'row'"
    class="order-row"
    :class="[`order-row--${order.status}`, { 'order-row--openable': openable }]"
    @click="onCardClick"
  >
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
      <div class="order-row__meta">
        <span class="order-row__num">№&nbsp;{{ order.shortId ?? order.id }}</span>
        <span class="order-row__sep" aria-hidden="true">·</span>
        <span>{{ formatDate(order.createdAt) }}</span>
      </div>
      <!-- Пункт выдачи — строкой под номером, а не отдельной ячейкой: это
           часть ответа «что за заказ», как адрес в чеке. Значок карты стоит
           сразу за адресом, не уплывает к правому краю карточки. -->
      <div
        v-if="order.pvzName || order.pvz"
        class="order-row__pvz"
        :class="{ 'order-row__pvz--mappable': hasMap }"
        @click.stop="hasMap && emit('map', order)"
      >
        <q-icon name="place" size="14px" class="order-row__pvz-icon" />
        <span v-if="order.pvzName" class="order-row__pvz-name">{{ order.pvzName }}</span>
        <span v-if="order.pvz" class="order-row__pvz-addr">{{ order.pvz }}</span>
        <q-icon v-if="hasMap" name="map" size="14px" class="order-row__pvz-map" />
      </div>
    </div>

    <div class="order-row__money">
      <div class="order-row__sum">{{ formatPrice(order.totalCost) }}</div>
      <div class="order-row__qty">{{ order.units }}&nbsp;{{ order.unitLabel ?? 'ед.' }}</div>
      <div v-if="order.feeNote" class="order-row__fee-note">{{ order.feeNote }}</div>
    </div>

    <div class="order-row__state">
      <BaseBadge :variant="order.statusVariant" class="order-row__status">
        {{ order.statusLabel }}
      </BaseBadge>
      <!-- Сбор партии живёт под бейджем: полоса объясняет состояние «ожидает
           сборки», поэтому ходит вместе с ним, а не отдельной балкой на всю
           ширину карточки. -->
      <div v-if="order.progress !== undefined" class="order-row__progress">
        <q-linear-progress
          class="order-row__progress-bar"
          :value="order.progress"
          rounded
          size="3px"
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
        <div class="order-card__fact-value">{{ order.units }} {{ order.unitLabel ?? 'ед.' }}</div>
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

// Строчная раскладка (layout="row"). Сетка с именованными зонами: на широком
// экране один ряд «товар · сумма · состояние», на узком те же зоны становятся
// двумя ярусами. Ширины зон фиксированы там, где важна колонность списка
// (сумма над суммой, бейдж над бейджем), и тянется только зона товара.
.order-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  grid-template-areas:
    'thumb ident money state'
    'actions actions actions actions';
  column-gap: var(--p-6, 24px);
  align-items: start;
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

  // Миниатюра товара — фиксированный квадрат, как в корзине и каталоге.
  &__thumb {
    grid-area: thumb;
    width: 56px;
    height: 56px;
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
    background: var(--p-surface-2);
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

  // Зона товара: название, номер с датой, пункт выдачи. Единственная, что
  // тянется, — отдаёт место остальным первой.
  &__ident {
    grid-area: ident;
    min-width: 0;
    // Миниатюра 56px, текст в три строки чуть ниже — крохотный сдвиг вниз
    // выравнивает заголовок по верхней кромке картинки оптически.
    padding-top: 1px;
  }

  &__title {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    letter-spacing: var(--p-ls-h3, -0.01em);
    line-height: var(--p-lh-h3, 1.3);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-1, 4px) var(--p-2, 8px);
    margin-top: 2px;
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

  // Пункт выдачи — одна строка: значок, имя участка, адрес, значок карты.
  // Всё в потоке текста, ничего не прижато к краю карточки.
  &__pvz {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px var(--p-2, 8px);
    margin-top: var(--p-2, 8px);
    font-size: var(--p-fs-body-sm, 13px);
    min-width: 0;

    &--mappable {
      cursor: pointer;

      .order-row__pvz-addr {
        color: var(--p-primary);
      }

      &:hover .order-row__pvz-addr,
      &:hover .order-row__pvz-map {
        color: var(--p-primary-hover);
      }
    }
  }

  &__pvz-icon {
    color: var(--p-ink-3);
    flex-shrink: 0;
  }

  &__pvz-name {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__pvz-addr {
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__pvz-map {
    color: var(--p-primary);
    flex-shrink: 0;
  }

  // Зона «сколько»: сумма — герой, под ней количество как подпись. Ширина
  // зафиксирована, текст прижат вправо: «650 ₽» и «1 300 ₽» в соседних
  // строках встают в один столбец.
  &__money {
    grid-area: money;
    min-width: 120px;
    text-align: right;
    // Опускаем на высоту строки заголовка: сумма стоит на одной линии с
    // названием товара, а не на волосок выше.
    padding-top: 1px;
  }

  &__sum {
    font-size: var(--p-fs-h2, 18px);
    font-weight: 700;
    letter-spacing: var(--p-ls-h2, -0.01em);
    line-height: var(--p-lh-h3, 1.3);
    color: var(--p-ink);
    font-feature-settings: 'tnum' 1;
    white-space: nowrap;
  }

  &__qty {
    margin-top: 2px;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    white-space: nowrap;
  }

  // Пояснение поставщику про цену для заказчика — переносится внутри своей
  // зоны, не расталкивает соседей.
  &__fee-note {
    margin-top: 2px;
    max-width: 200px;
    font-size: var(--p-fs-body-sm, 12px);
    color: var(--p-ink-3);
  }

  // Зона состояния: бейдж, под ним полоса сбора партии той же ширины.
  // Ширина фиксирована — у одного заказа полоса есть, у другого нет, и на
  // авто-ширине столбец «дышал» бы от строки к строке.
  &__state {
    grid-area: state;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--p-2, 8px);
    width: 200px;
    // Бейдж по вертикали центрируется относительно строки заголовка.
    padding-top: 1px;
  }

  &__status {
    white-space: nowrap;
  }

  &__progress {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    width: 100%;
  }

  &__progress-bar {
    width: 100%;
    border-radius: var(--p-r-sm, 8px);
  }

  &__progress-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-eyebrow, 11px);
    color: var(--p-ink-3);
    white-space: nowrap;
  }

  &__progress-help {
    color: var(--p-ink-3);
    cursor: help;
  }

  &__actions {
    grid-area: actions;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    margin-top: var(--p-3, 12px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  // Узкий экран: два яруса. Вверху миниатюра, рядом с ней название, номер,
  // пункт выдачи и под ними состояние с полосой. Внизу — строка-чек:
  // количество слева, сумма справа, отбита волосяной линией.
  @media (max-width: 760px) {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'thumb ident'
      'thumb state'
      'money money'
      'actions actions';
    column-gap: var(--p-4, 16px);
    padding: var(--p-4, 16px);

    &__state {
      width: auto;
      align-items: flex-start;
      margin-top: var(--p-2, 8px);
      padding-top: 0;
    }

    &__progress {
      align-items: flex-start;
      max-width: 220px;
    }

    &__money {
      display: flex;
      flex-direction: row-reverse;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 2px var(--p-3, 12px);
      min-width: 0;
      margin-top: var(--p-3, 12px);
      padding-top: var(--p-3, 12px);
      border-top: 1px solid var(--p-line);
      text-align: left;
    }

    &__qty {
      margin-top: 0;
      white-space: normal;
    }

    &__fee-note {
      flex: 1 1 100%;
      max-width: none;
      text-align: right;
    }

    &__actions {
      justify-content: flex-start;
    }
  }
}
</style>
