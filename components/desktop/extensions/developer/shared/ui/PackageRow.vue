<template lang="pug">
//- Строка пакета по образцу строки заказа (OrderCard, layout="row"). Зоны:
//- опознание — «что это»: имя пакета, мета-строка, одна зависимая строка со
//- значком; деньги — «сколько»: цена в месяц и подпись под ней; состояние —
//- «на каком шаге»: бейдж и под ним только новое; действия — «что сделать».
//- Нажатие по строке открывает правую панель пакета. На узком экране те же
//- зоны встают в ярусы, раскладку меняет только сетка.
.package-row(
  role='button',
  tabindex='0',
  @click="emit('open')",
  @keydown.enter.prevent="emit('open')",
  @keydown.space.prevent="emit('open')"
)
  .package-row__ident
    .package-row__title {{ title }}
    .package-row__meta {{ meta }}
    .package-row__note(v-if='note', :class='{ "package-row__note--warn": noteWarn }')
      q-icon(:name='noteIcon', size='14px')
      span {{ note }}

  .package-row__money
    template(v-if='sum')
      .package-row__sum {{ sum }}
      .package-row__sum-caption {{ sumCaption }}

  .package-row__state
    .package-row__badges
      slot(name='badges')
      BaseBadge(:variant='badgeVariant') {{ badgeLabel }}
    .package-row__state-note(v-if='stateNote') {{ stateNote }}

  .package-row__actions(v-if='$slots.actions', @click.stop, @keydown.stop)
    slot(name='actions')

  q-icon.package-row__chevron(name='chevron_right', size='20px')
</template>

<script setup lang="ts">
import { BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';

/** Строка пакета в списках столов разработчика и администратора каталога. */
withDefaults(
  defineProps<{
    /** Имя пакета — самый крупный текст строки. */
    title: string;
    /** Мета-строка под именем: дата, версия, издатель через «·». */
    meta: string;
    /** Зависимая строка со значком: одна подробность, остальное — в панели. */
    note?: string;
    noteIcon?: string;
    /** Зависимая строка требует внимания (новые права, незнакомый порт). */
    noteWarn?: boolean;
    /** Цена в месяц; пусто — цены нет, зона денег молчит. */
    sum?: string;
    /** Подпись под ценой: пробный срок. */
    sumCaption?: string;
    badgeLabel: string;
    badgeVariant: BaseBadgeVariant;
    /** Под бейджем только новое: версия, причина, срок. */
    stateNote?: string;
  }>(),
  { note: '', noteIcon: 'info', noteWarn: false, sum: '', sumCaption: '', stateNote: '' },
);
const emit = defineEmits<{ open: [] }>();
</script>

<style scoped lang="scss">
.package-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(180px, auto) auto auto;
  grid-template-areas: 'ident money state actions chevron';
  column-gap: var(--p-6);
  align-items: center;
  padding: var(--p-4) var(--p-5);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  cursor: pointer;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);

  &:hover {
    border-color: var(--p-ink-3);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--p-line-1);
    box-shadow: inset var(--p-focus-ring);
  }

  // Единственная зона, что тянется: отдаёт место остальным первой.
  &__ident {
    grid-area: ident;
    min-width: 0;
  }

  &__title {
    font-family: var(--p-mono);
    font-size: var(--p-fs-h3);
    font-weight: 600;
    line-height: var(--p-lh-h3);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__meta {
    margin-top: 2px;
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__note {
    display: flex;
    align-items: center;
    gap: var(--p-1);
    margin-top: 2px;
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);

    &--warn {
      color: var(--p-warn);
    }
  }

  // Ширина зафиксирована, текст прижат вправо: цены соседних строк встают в один столбец.
  &__money {
    grid-area: money;
    min-width: 120px;
    text-align: right;
  }

  &__sum {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    line-height: var(--p-lh-h3);
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__sum-caption {
    margin-top: 2px;
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
    white-space: nowrap;
  }

  &__state {
    grid-area: state;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--p-1);
    text-align: right;
  }

  &__badges {
    display: flex;
    gap: var(--p-1);
    white-space: nowrap;
  }

  &__state-note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__actions {
    grid-area: actions;
    display: flex;
    gap: var(--p-2);
  }

  &__chevron {
    grid-area: chevron;
    color: var(--p-ink-3);
  }

  // Узкий экран: опознание сверху, состояние и цена под ним, действия — третьим ярусом.
  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'ident chevron'
      'state money'
      'actions actions';
    row-gap: var(--p-3);
    column-gap: var(--p-4);
    padding: var(--p-4);

    &__state {
      align-items: flex-start;
      text-align: left;
    }

    &__money {
      min-width: 0;
    }
  }
}
</style>
