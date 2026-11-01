<template lang="pug">
//- Единый каркас содержимого maximized-диалогов актов (приёмка / выдача /
//- подписи АПП). BaseDialog даёт шапку+футер; здесь — lead, опциональная
//- шапка сущности и панель-карточка под основной контент.
.act-dialog(:class='{ "act-dialog--wide": wide }')
  //- Шапка акта в колонке содержимого: что за процесс (подпись над), с кем
  //- (имя крупно) и сводка (мета-строка). Заголовок окна в полосе BaseDialog
  //- при этом не задают — иначе он стоит у левого края экрана, а содержимое
  //- по центру, и окно читается двумя колонками.
  .act-dialog__head(v-if='eyebrow || title || $slots.head')
    .act-dialog__eyebrow(v-if='eyebrow') {{ eyebrow }}
    .act-dialog__title(v-if='title') {{ title }}
    .act-dialog__meta(v-if='meta') {{ meta }}
    slot(name='head')

  .act-dialog__lead(v-if='lead || $slots.lead')
    slot(name='lead') {{ lead }}

  BaseCard.act-dialog__panel
    slot

  .act-dialog__after(v-if='$slots.after')
    slot(name='after')
</template>

<script setup lang="ts">
import { BaseCard } from 'src/shared/ui/base';

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
    /** Без max-width — для широких таблиц сверки. */
    wide?: boolean;
  }>(),
  {
    lead: '',
    eyebrow: '',
    title: '',
    meta: '',
    wide: false,
  },
);
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

  &__head {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__eyebrow {
    font-size: var(--p-fs-eyebrow, 11px);
    font-weight: 600;
    letter-spacing: var(--p-ls-eyebrow, 0.08em);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__title {
    font-size: var(--p-fs-h2, 18px);
    font-weight: 700;
    letter-spacing: var(--p-ls-h2, -0.012em);
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
</style>
