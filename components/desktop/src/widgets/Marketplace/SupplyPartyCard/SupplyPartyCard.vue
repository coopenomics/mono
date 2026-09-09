<script lang="ts" setup>
import { computed } from 'vue';
import { BaseBadge, BaseButton } from 'src/shared/ui/base';
import { orderStatusDisplay, type DomainOrderStatus } from 'src/widgets/Marketplace/OrderCard';

/**
 * Карточка партии Стола заказов — заказы одной пары «предложение × участок».
 *
 * Три яруса, каждый отвечает на свой вопрос. Шапка — «что и куда»: товар,
 * участок с адресом и состояние партии. Середина — «как идёт сбор» и «что
 * именно заказано»: полоса накопления и разбор партии по таре. Подвал —
 * «сколько всего» и действия поставщика.
 *
 * Разбор по таре обязателен: партия копится к минимальному объёму поставки в
 * базовой единице («15 л»), но отгружать поставщику предстоит упаковки, и по
 * одному итогу непонятно, что везти — тридцать поллитровок или пятнадцать
 * литровых (жалоба 2026-09-09).
 *
 * Вариативные части — слотами: `#hint` (пояснение под полосой сбора) и
 * `#actions` (кнопки подвала).
 */

const props = defineProps<{
  productName: string;
  /** Обложка товара — по ней партия узнаётся с одного взгляда, без чтения. */
  imageUrl?: string | null;
  pvzName: string;
  /** Адрес участка: поставщику везти туда, а название участка адреса не заменяет. */
  pvzAddress?: string | null;
  /** У участка есть координаты — показываем кнопку «На карте» (эмитит `map`). */
  mappable?: boolean;
  /** Доменный статус-этап партии (минимальный по рангу среди заказов). */
  stageStatus: DomainOrderStatus | string;
  /** Сколько заказов пайщиков вошло в партию — подпись к разбору состава. */
  orderCount: number;
  /**
   * Заполнение полосы сбора 0..1 (доля от минимального объёма поставки).
   * Абсолютных величин на полосе нет намеренно: набор идёт разными упаковками
   * одного товара, а цель сбора всегда в базовой единице. Что именно набрано —
   * ниже, в разборе по таре.
   */
  progress: number;
  /** Цвет полосы (Quasar color): primary пока копится, positive когда набрано/принято. */
  barColor: string;
  /**
   * Показывать полосу вообще. Имеет смысл, только пока партия копится к цели —
   * после приёма/получения она всегда «100%» и не несёт информации, только шум
   * (жалоба 2026-08-02).
   */
  showProgress?: boolean;
  /**
   * Разбор партии по таре: строка на каждую упаковку — подпись тары, сколько
   * упаковок, сколько это в базовой единице и на какую сумму.
   */
  breakdown?: Array<{ id: string; label: string; units: string; volume: string; cost: string }>;
  /** Подпись итога, напр. «Итого партии». */
  totalLabel: string;
  /** Деньги партии, напр. «1 500 ₽» — главная величина карточки. */
  totalValue: string;
  /**
   * Объём партии в базовой единице, напр. «15 л». Показывается рядом с
   * деньгами: это разные вещи — сколько денег и сколько имущества.
   */
  totalUnits?: string;
  /**
   * Пояснение под итогом — например «С учётом взноса пайщиков: 1 600 ₽», где
   * `totalValue` — себестоимость поставщика без взноса.
   */
  totalFeeNote?: string;
  /** Карточка кликабельна (курсор-указатель + role=button + emit `card-click`). */
  clickable?: boolean;
}>();

const emit = defineEmits<{ (e: 'card-click'): void; (e: 'map'): void }>();

const statusDisplay = computed(() => orderStatusDisplay(props.stageStatus));

/** «2 заказа пайщиков» — состав партии всегда из чьих-то заказов. */
const orderCountLabel = computed(() => {
  const n = props.orderCount;
  const tail = n % 10 === 1 && n % 100 !== 11 ? 'заказ' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'заказа' : 'заказов';
  return `${n} ${tail}`;
});

function onCardClick(): void {
  if (props.clickable) emit('card-click');
}
</script>

<template lang="pug">
.supply-party(
  :class="{ 'supply-party--clickable': clickable }",
  :role="clickable ? 'button' : undefined",
  :tabindex="clickable ? 0 : undefined",
  @click="onCardClick",
  @keyup.enter="onCardClick"
)
  //- Ярус «что и куда»: товар с участком слева, состояние партии справа.
  .supply-party__head
    .supply-party__thumb
      q-img.supply-party__thumb-img(v-if="imageUrl", :src="imageUrl", ratio="1", fit="contain")
      .supply-party__thumb-empty(v-else)
        q-icon(name="image", size="20px")

    .supply-party__ident
      .supply-party__name {{ productName }}
      .supply-party__place
        q-icon.supply-party__place-icon(name="place", size="14px")
        span.supply-party__place-name КУ «{{ pvzName }}»
        span.supply-party__place-addr(v-if="pvzAddress") {{ pvzAddress }}
        BaseButton.supply-party__map-btn(
          v-if="mappable",
          variant="ghost",
          size="sm",
          @click.stop="emit('map')"
        )
          template(#icon-left)
            q-icon(name="map", size="16px")
          | На карте

    .supply-party__marks
      BaseBadge(:variant="statusDisplay.variant") {{ statusDisplay.label }}

  //- Ярус «как идёт сбор».
  .supply-party__progress(v-if="showProgress !== false")
    .supply-party__progress-top
      span.supply-party__progress-label Собрано
      span.supply-party__progress-percent {{ Math.round(progress * 100) }}%
    q-linear-progress.supply-party__progress-bar(
      :value="progress",
      rounded,
      size="6px",
      :color="barColor",
      track-color="grey-3"
    )
    .supply-party__progress-hint(v-if="$slots.hint")
      slot(name="hint")

  //- Ярус «что именно заказано»: строка на каждую упаковку — везти предстоит
  //- упаковки, а не литры.
  .supply-party__breakdown(v-if="breakdown && breakdown.length")
    .supply-party__breakdown-head
      span.supply-party__breakdown-title Заказано
      span.supply-party__breakdown-count {{ orderCountLabel }}
    .supply-party__line(v-for="row in breakdown", :key="row.id")
      span.supply-party__line-pkg {{ row.label }}
      span.supply-party__line-units {{ row.units }}
      span.supply-party__line-volume {{ row.volume }}
      span.supply-party__line-cost {{ row.cost }}

  //- Ярус «сколько всего» и действия.
  .supply-party__foot
    .supply-party__total
      span.supply-party__total-label {{ totalLabel }}
      .supply-party__total-row
        span.supply-party__total-val {{ totalValue }}
        span.supply-party__total-units(v-if="totalUnits") · {{ totalUnits }}
      span.supply-party__total-fee-note(v-if="totalFeeNote") {{ totalFeeNote }}
    .supply-party__actions
      slot(name="actions")
</template>

<style scoped lang="scss">
.supply-party {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  background: var(--p-surface);
  padding: var(--p-5, 20px) var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // Отклик на наведение такой же, как у карточки заказа: тонкая смена цвета
  // рамки, без теней и подъёма.
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: var(--p-ink-3);
  }

  &--clickable {
    cursor: pointer;

    &:hover {
      border-color: var(--p-primary-line);
      background: var(--p-surface-2);
    }
  }

  // Шапка: миниатюра, рядом товар с участком, состояние прижато вправо по
  // верхнему краю — длинное имя товара не толкает бейдж вниз.
  &__head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--p-3, 12px) var(--p-4, 16px);
  }

  &__thumb {
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

  &__ident {
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-h3, 15px);
    line-height: var(--p-lh-h3, 1.4);
    letter-spacing: var(--p-ls-h3, -0.005em);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  // Участок одной строкой: значок, название, адрес, кнопка карты. Адрес не
  // уводим на отдельную строку — это продолжение одного ответа «куда везти».
  &__place {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px var(--p-2, 8px);
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    min-width: 0;
  }

  &__place-icon {
    color: var(--p-ink-3);
    flex-shrink: 0;
  }

  &__place-name {
    color: var(--p-ink-2);
  }

  &__place-addr {
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__marks {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__progress {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  // Подпись сбора — над полосой: цифра внутри полосы читалась хуже и делала
  // карточку тяжелее.
  &__progress-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-2, 8px);
  }

  &__progress-label {
    font-size: var(--p-fs-meta, 12px);
    letter-spacing: var(--p-ls-eyebrow, 0.08em);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__progress-bar {
    border-radius: var(--p-r-pill, 999px);
  }

  &__progress-percent {
    font-family: var(--p-mono);
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__progress-hint {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  // Разбор по таре: подпись тары тянется, числа стоят столбцами и выровнены
  // вправо — строки читаются сверху вниз, а не как сплошной текст.
  &__breakdown {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
  }

  &__breakdown-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    background: var(--p-surface-2);
    border-bottom: 1px solid var(--p-line);
  }

  &__breakdown-title {
    font-size: var(--p-fs-meta, 12px);
    letter-spacing: var(--p-ls-eyebrow, 0.08em);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__breakdown-count {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto auto;
    align-items: baseline;
    gap: var(--p-2, 8px) var(--p-4, 16px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
    font-size: var(--p-fs-body-sm, 13px);

    &:first-of-type {
      border-top: none;
    }
  }

  &__line-pkg {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__line-units {
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__line-volume {
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    min-width: 64px;
    text-align: right;
  }

  &__line-cost {
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    min-width: 96px;
    text-align: right;
  }

  &__foot {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    padding-top: var(--p-4, 16px);
    border-top: 1px solid var(--p-line);
  }

  &__total {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    min-width: 0;
  }

  &__total-label {
    font-size: var(--p-fs-meta, 12px);
    letter-spacing: var(--p-ls-eyebrow, 0.08em);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  // Деньги — главная величина партии, объём рядом приглушён.
  &__total-row {
    display: flex;
    align-items: baseline;
    gap: var(--p-1, 4px);
    flex-wrap: wrap;
  }

  &__total-val {
    font-size: var(--p-fs-h2, 18px);
    font-weight: 700;
    letter-spacing: var(--p-ls-h2, -0.012em);
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__total-units {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  &__total-fee-note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    flex-wrap: wrap;
  }

  // Узкий экран: бейдж состояния переезжает под товар, числа разбора встают в
  // две колонки, действия занимают строку целиком.
  @media (max-width: 760px) {
    padding: var(--p-4, 16px);

    &__head {
      grid-template-columns: auto minmax(0, 1fr);
    }

    &__marks {
      grid-column: 1 / -1;
    }

    &__line {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    &__line-volume {
      text-align: left;
      min-width: 0;
    }

    &__line-cost {
      text-align: right;
    }

    &__foot {
      align-items: stretch;
    }

    &__actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
}
</style>
