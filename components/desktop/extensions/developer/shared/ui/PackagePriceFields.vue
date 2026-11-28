<template lang="pug">
//- Цена пакета: сумма в месяц и пробный срок рядом, на узком экране — одна
//- под другой. Подсказки — в одну строку: поле ввода держит место под одну
//- строку подсказки, вторая строка налезает на следующее поле.
.price-fields
  AmountInput(
    v-model='rubPerMonth',
    symbol='₽',
    :precision='2',
    :label="$t('developer.price.priceLabel')",
    :hint="$t('developer.price.priceHint')",
    :error='errors.rubPerMonth'
  )
  BaseInput(
    v-model='trialDays',
    type='number',
    :label="$t('developer.price.trialLabel')",
    :hint="$t('developer.price.trialHint')",
    :error='errors.trialDays'
  )
</template>

<script setup lang="ts">
import { BaseInput } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain';

/** Поля цены пакета: при регистрации пакета и при смене цены. */
defineProps<{ errors: { rubPerMonth: string; trialDays: string } }>();

const rubPerMonth = defineModel<number | string | null>('rubPerMonth', { required: true });
const trialDays = defineModel<number | string | null>('trialDays', { required: true });
</script>

<style scoped>
.price-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--p-4);
}
@media (max-width: 600px) {
  .price-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
