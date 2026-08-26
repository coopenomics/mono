<template lang="pug">
BaseButton(
  :variant='micro ? "ghost" : "primary"'
  :size='micro ? "sm" : "md"'
  :icon-only='micro'
  :aria-label='micro ? "Пополнить кошелёк членских взносов" : undefined'
  @click='open'
)
  template(#icon-left)
    q-icon(name='add' size='16px').q-mr-xs
  | Пополнить
  q-tooltip(v-if='micro') Пополнить кошелёк членских взносов
</template>
<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base'
import { useConvertToBillingVisibility } from '../model'

interface Props {
  micro?: boolean;
}

withDefaults(defineProps<Props>(), {
  micro: false,
});

const { isVisible } = useConvertToBillingVisibility()

const open = () => {
  isVisible.value = true
}
</script>
