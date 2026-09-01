<template lang="pug">
//- Иконка идёт слотом #icon-left, а не внутрь подписи: в шапке на узком экране
//- канон скрывает .base-btn__label вместе со всем его содержимым
BaseButton(
  variant='primary',
  size='sm',
  aria-label='Объявить собрание',
  @click='emit("click")'
)
  template(#icon-left)
    q-icon(name='add', size='18px')
  | Объявить собрание
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

const emit = defineEmits<{ (e: 'click'): void }>();
</script>
