<template lang="pug">
BaseButton(
  :variant='micro ? "ghost" : "primary"'
  :size='micro ? "sm" : "md"'
  :icon-only='micro'
  :aria-label='micro ? "Конвертировать в членский" : undefined'
  @click='open'
)
  template(#icon-left)
    q-icon(:name='micro ? "fa-solid fa-right-left" : "sync_alt"' size='16px').q-mr-xs
  | Конвертировать в членский
  q-tooltip(v-if='micro') Конвертировать в членский
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
