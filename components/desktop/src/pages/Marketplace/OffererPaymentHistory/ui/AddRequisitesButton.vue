<template lang="pug">
//- Кнопка шапки страницы выплат поставщика. Иконка идёт слотом #icon-left:
//- в шапке на узком экране канон скрывает подпись кнопки целиком.
BaseButton(
  variant='primary',
  size='sm',
  :aria-label='$t("marketplace.offererPaymentHistoryPage.addDetailsAction")',
  @click='props.onClick?.()'
)
  template(#icon-left)
    q-icon(name='add_card', size='18px')
  | {{ $t('marketplace.offererPaymentHistoryPage.addDetailsAction') }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

const props = defineProps<{
  /** Действие шапки рендерится через useHeaderActions — emit из шапки до страницы не доходит, поэтому колбэк. */
  onClick?: () => void;
}>();
</script>
