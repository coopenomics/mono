<template lang="pug">
q-btn(
  @click='open',
  :color='micro ? "accent" : "primary"',
  :flat='micro',
  :dense='micro',
  :size='micro ? "sm" : undefined',
  :unelevated='!micro'
)
  q-icon(:name='micro ? "fa-solid fa-right-left" : "sync_alt"')
  span(v-if='!micro').q-ml-sm Конвертировать в членский
  q-tooltip(v-if='micro') Конвертировать в членский
</template>

<script setup lang="ts">
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
