<template lang="pug">
//- Иконка идёт слотом #icon-left: в шапке на узком экране канон скрывает
//- подпись кнопки вместе с её содержимым.
BaseButton(
  variant='primary',
  size='sm',
  :aria-label='$t("expenses.counterpartiesPage.addAction")',
  @click='props.onClick?.()'
)
  template(#icon-left)
    q-icon(name='add_business', size='18px')
  | {{ $t('expenses.counterpartiesPage.addAction') }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

const props = defineProps<{
  /** Действие шапки рендерится через useHeaderActions — emit из шапки до страницы не доходит, поэтому колбэк. */
  onClick?: () => void;
}>();
</script>
