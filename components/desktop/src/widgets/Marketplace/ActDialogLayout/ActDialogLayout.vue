<template lang="pug">
//- Единый каркас содержимого maximized-диалогов актов (приёмка / выдача /
//- подписи АПП). Два режима.
//-
//- Обычный — колонка 960px: шапка, подсказка, карточка с содержимым, «после».
//-
//- Рабочая страница — когда передан слот #aside (окно с `canvas` у BaseDialog):
//- холст страницы, шапка акта во всю ширину колонки (аватар → процесс → имя →
//- сводка, крестик в той же строке), слева карточка с позициями, справа липкая
//- карточка сводки с итогом и действиями. Так устроены страницы заказа в
//- магазинных админках и корзина Стола заказов: на белом листе без опоры
//- содержимое висело посреди экрана (слово владельца 01.11.2026).
.act-dialog(:class='{ "act-dialog--wide": wide, "act-dialog--workspace": workspace }')
  .act-dialog__top(v-if='eyebrow || title || $slots.head || closable')
    Avatar.act-dialog__avatar(v-if='avatarName', :name='avatarName', size='lg')
    .act-dialog__head
      .act-dialog__eyebrow(v-if='eyebrow') {{ eyebrow }}
      .act-dialog__title(v-if='title') {{ title }}
      .act-dialog__meta(v-if='meta') {{ meta }}
      slot(name='head')
    BaseButton.act-dialog__close(
      v-if='closable',
      variant='ghost',
      icon-only,
      :aria-label='$t("common.action.close")',
      @click='emit("close")'
    )
      template(#icon-left)
        q-icon(name='close', size='20px')

  .act-dialog__grid(v-if='workspace')
    .act-dialog__main
      BaseCard.act-dialog__panel(:title='panelTitle || undefined')
        .act-dialog__lead(v-if='lead || $slots.lead')
          slot(name='lead') {{ lead }}
        slot
      .act-dialog__after(v-if='$slots.after')
        slot(name='after')
    aside.act-dialog__aside
      slot(name='aside')

  template(v-else)
    .act-dialog__lead(v-if='lead || $slots.lead')
      slot(name='lead') {{ lead }}

    BaseCard.act-dialog__panel
      slot

    .act-dialog__after(v-if='$slots.after')
      slot(name='after')
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { Avatar, BaseButton, BaseCard } from 'src/shared/ui/base';

withDefaults(
  defineProps<{
    /** Подсказка под шапкой (или слот #lead). */
    lead?: string;
    /** Процесс над именем: «Приёмка имущества поставщика». */
    eyebrow?: string;
    /** Главное имя акта: поставщик, пайщик. */
    title?: string;
    /** Сводка под именем: число позиций, ТТН. */
    meta?: string;
    /** Имя для аватара слева от шапки. */
    avatarName?: string;
    /** Крестик в строке шапки (окно без стандартной полосы заголовка). */
    closable?: boolean;
    /** Заголовок карточки с позициями в режиме рабочей страницы. */
    panelTitle?: string;
    /** Без max-width — для широких таблиц сверки. */
    wide?: boolean;
  }>(),
  {
    lead: '',
    eyebrow: '',
    title: '',
    meta: '',
    avatarName: '',
    closable: false,
    panelTitle: '',
    wide: false,
  },
);

const emit = defineEmits<{ close: [] }>();

const slots = useSlots();
/** Режим рабочей страницы включает слот сводки справа. */
const workspace = computed(() => !!slots.aside);
</script>

<style scoped lang="scss">
.act-dialog {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &--wide {
    max-width: none;
  }

  &--workspace {
    max-width: 1180px;
    gap: var(--p-6, 24px);
    padding: var(--p-4, 16px) var(--p-2, 8px) var(--p-6, 24px);
  }

  &__top {
    display: flex;
    align-items: center;
    gap: var(--p-4, 16px);
  }

  &__avatar {
    flex: 0 0 auto;
  }

  &__head {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__close {
    flex: 0 0 auto;
    align-self: flex-start;
  }

  &__eyebrow {
    font-size: var(--p-fs-eyebrow, 11px);
    font-weight: 600;
    letter-spacing: var(--p-ls-eyebrow, 0.08em);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__title {
    font-size: var(--p-fs-h1, 22px);
    font-weight: 700;
    letter-spacing: var(--p-ls-h1, -0.016em);
    line-height: var(--p-lh-h1, 1.25);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__lead {
    font-size: var(--p-fs-body-sm, 13px);
    line-height: 1.45;
    color: var(--p-ink-3);
  }

  // Позиции слева тянутся, сводка справа фиксированной ширины.
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: var(--p-5, 20px);
    align-items: start;
  }

  &__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  // Сводка не уезжает при прокрутке длинного списка позиций.
  &__aside {
    position: sticky;
    top: var(--p-4, 16px);
  }

  &__panel {
    // Карточка-контейнер: hairline + surface, не «белый лист» диалога.
    :deep(.base-card__body) {
      display: flex;
      flex-direction: column;
      gap: var(--p-3, 12px);
    }
  }

  &__after {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }
}

@media (max-width: 960px) {
  .act-dialog__grid {
    grid-template-columns: 1fr;
  }

  .act-dialog__aside {
    position: static;
  }
}
</style>
