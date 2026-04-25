<script setup lang="ts">
  import { computed, withDefaults } from 'vue'
  import type { IStepProps } from '../../model'
  const props = withDefaults(defineProps<IStepProps>(), {})
  const currentStep = computed(()=> props.currentStep)
</script>

<template lang="pug">
div
  q-step(
    :name="2"
    title="Ожидаем решение совета"
    icon="settings"
    :done="currentStep > 2"
  )
    span Совет кооператива принимает решение по удовлетворению вашей потребности.

</template>
