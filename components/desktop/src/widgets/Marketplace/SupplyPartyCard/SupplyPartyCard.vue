<script lang="ts" setup>
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base';
import { orderStatusDisplay, type DomainOrderStatus } from 'src/widgets/Marketplace/OrderCard';

/**
 * Единая карточка партии Стола заказов — одна вёрстка на всех столах и стадиях.
 *
 * Партия (заказы по паре оферта × КУ) показывается одинаково и у заказчика
 * («Коллективный заказ»), и у поставщика («Входящие заказы»), на любом этапе
 * (копится / принята / в работе): шапка (товар + КУ + бейдж этапа + счётчик),
 * прогресс-бар сбора, состав партии строками, подвал (итог + действия).
 * Меняются только данные и тексты — не вёрстка. Раньше каждая страница
 * рисовала свою карточку (накопитель ≠ принятая) — путало и нарушало DRY.
 *
 * Вариативные части — слотами:
 *  - `#hint`    — пояснение под прогресс-баром (тексты у столов разные);
 *  - `#actions` — кнопки в подвале (у поставщика «Принять/Отклонить», у
 *                 заказчика пусто).
 */

const props = defineProps<{
  productName: string;
  pvzName: string;
  /** Доменный статус-этап партии (минимальный по рангу среди заказов). */
  stageStatus: DomainOrderStatus | string;
  orderCount: number;
  /**
   * Скрыть бейдж «N зак.» (число заказов в партии). У заказчика число других
   * участников нерелевантно — ему важно лишь наполнение партии; у поставщика
   * счётчик остаётся.
   */
  hideOrderCount?: boolean;
  /** Левая подпись прогресса целиком, напр. «Объём партии: 5 кг». */
  volumeLabel: string;
  /** Правая muted-подпись (цель сбора), напр. «цель — от 10 кг». Пусто — скрыта. */
  targetLabel?: string;
  /** Заполнение прогресс-бара 0..1. */
  progress: number;
  /** Цвет бара (Quasar color): primary пока копится, positive когда набрано/принято. */
  barColor: string;
  /** Состав партии строками: кто · сколько · стоимость. */
  // `who` опционально: на столе поставщика ФИО заказчиков НЕ показываем
  // (приватность — поставщику видны только объёмы партии, не кто заказал).
  members: Array<{ id: string; who?: string; qty: string; cost: string }>;
  /** Подпись итога, напр. «Итого партии» / «Ваш вклад в партию». */
  totalLabel: string;
  /** Значение итога, напр. «1 200 ₽ · 5 кг». */
  totalValue: string;
  /**
   * Пояснение под итогом (requirement b6) — например «С учётом взноса
   * пайщиков: 1 300 ₽» на столе поставщика, где `totalValue` — его
   * себестоимость без взноса. У заказчика не передаётся.
   */
  totalFeeNote?: string;
  /**
   * Карточка кликабельна (курсор-указатель + role=button + emit `card-click`).
   * У заказчика на «Коллективном заказе» клик ведёт в карточку предложения; у
   * поставщика по умолчанию выключено (карточка — только сводка).
   */
  clickable?: boolean;
}>();

const emit = defineEmits<{ (e: 'card-click'): void }>();

const statusDisplay = computed(() => orderStatusDisplay(props.stageStatus));

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
  .supply-party__head
    .row.items-center.q-gutter-sm.no-wrap
      div.col
        .t-h3 {{ productName }}
        .t-muted.supply-party__sub
          q-icon(name="place", size="14px")
          | КУ «{{ pvzName }}»
      BaseBadge(:variant="statusDisplay.variant") {{ statusDisplay.label }}
      span.chip.chip--accent(v-if="!hideOrderCount")
        q-icon(name="layers", size="14px")
        | {{ orderCount }} заказ

  .supply-party__progress
    .supply-party__progress-row
      span.t-muted {{ volumeLabel }}
      span.t-muted(v-if="targetLabel") {{ targetLabel }}
    q-linear-progress.supply-party__progress-bar(
      :value="progress",
      rounded,
      size="10px",
      :color="barColor",
      track-color="grey-3"
    )
    .t-muted.supply-party__progress-hint(v-if="$slots.hint")
      slot(name="hint")

  //- Разбивка по участникам — только когда есть смысловые строки. На столе
  //- поставщика ФИО скрыты, поэтому страница не передаёт состав вовсе (одна
  //- анонимная строка = дубль «Итого партии»); здесь блок просто не рисуется.
  .supply-party__members(v-if="members.length")
    .supply-party__member(
      v-for="m in members",
      :key="m.id",
      :class="{ 'supply-party__member--anon': !m.who }"
    )
      span.supply-party__member-who(v-if="m.who") {{ m.who }}
      span.supply-party__member-qty {{ m.qty }}
      span.supply-party__member-cost {{ m.cost }}

  .supply-party__foot
    .supply-party__total
      span.t-muted {{ totalLabel }}
      span.supply-party__total-val {{ totalValue }}
      span.supply-party__total-fee-note(v-if="totalFeeNote") {{ totalFeeNote }}
    q-space
    slot(name="actions")
</template>

<style scoped lang="scss">
.supply-party {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  background: var(--p-surface);
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);

  &--clickable {
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;

    &:hover {
      border-color: var(--p-primary-line);
      background: var(--p-surface-2);
    }
  }

  &__sub {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }

  &__progress {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__progress-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--p-fs-body);
  }

  &__progress-bar {
    border-radius: var(--p-r-sm, 8px);
  }

  &__progress-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__members {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
  }

  &__member {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--p-4, 16px);
    align-items: center;
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border-top: 1px solid var(--p-line);

    &:first-child {
      border-top: none;
    }

    // Без ФИО (поставщик): объём слева, сумма справа.
    &--anon {
      grid-template-columns: 1fr auto;
    }
  }

  &__member-who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__member-qty {
    color: var(--p-ink-2);
  }

  &__member-cost {
    font-variant-numeric: tabular-nums;
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    padding-top: var(--p-4, 16px);
    border-top: 1px solid var(--p-line);
  }

  &__total {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__total-val {
    font-size: var(--p-fs-body);
    color: var(--p-ink-1);
    font-variant-numeric: tabular-nums;
  }

  &__total-fee-note {
    font-size: var(--p-fs-body-sm, 12px);
    color: var(--p-ink-3);
  }
}
</style>
