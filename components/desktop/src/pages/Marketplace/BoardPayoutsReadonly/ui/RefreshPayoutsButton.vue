<template lang="pug">
//- Иконка идёт слотом #icon-left: в шапке на узком экране канон скрывает
//- .base-btn__label вместе со всем его содержимым.
BaseButton(
  variant='ghost',
  size='sm',
  :loading='props.loading',
  aria-label='Обновить ленту выплат',
  @click='props.onClick?.()'
)
  template(#icon-left)
    q-icon(name='refresh', size='18px')
  | Обновить
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

const props = defineProps<{
  /** Header-action рендерится через useHeaderActions — emit оттуда не проходит, поэтому колбэк. */
  onClick?: () => void;
  loading?: boolean;
}>();
</script>
