<template lang="pug">
q-btn(
  color="primary"
  icon="sync_alt"
  label="Конвертировать в членский"
  @click="open"
  unelevated
)
</template>

<script setup lang="ts">
import { useConvertToBillingVisibility } from '../model'

const { isVisible } = useConvertToBillingVisibility()

const open = () => {
  isVisible.value = true
}
</script>
