<template lang="pug">
//- Единый каркас содержимого maximized-диалогов актов (приёмка / выдача /
//- подписи АПП). BaseDialog даёт шапку+футер; здесь — lead, опциональная
//- шапка сущности и панель-карточка под основной контент.
.act-dialog(:class='{ "act-dialog--wide": wide }')
  .act-dialog__head(v-if='$slots.head')
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
    /** Без max-width — для широких таблиц сверки. */
    wide?: boolean;
  }>(),
  {
    lead: '',
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
    gap: var(--p-2, 8px);
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
