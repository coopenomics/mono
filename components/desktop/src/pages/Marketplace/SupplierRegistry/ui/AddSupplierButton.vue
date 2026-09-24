<template lang="pug">
//- Иконка идёт слотом #icon-left, а не внутрь подписи: в шапке на узком экране
//- канон скрывает .base-btn__label вместе со всем его содержимым.
BaseButton(
  variant='primary',
  size='sm',
  :aria-label='$t("marketplace.addSupplierButton.label")',
  @click='props.onClick?.()'
)
  template(#icon-left)
    q-icon(name='person_add', size='18px')
  | {{ $t('marketplace.addSupplierButton.label') }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

const props = defineProps<{
  /** Header-action рендерится через useHeaderActions — emit оттуда не проходит, поэтому колбэк. */
  onClick?: () => void;
}>();
</script>
