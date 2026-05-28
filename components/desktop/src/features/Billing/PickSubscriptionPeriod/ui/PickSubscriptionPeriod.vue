<template lang="pug">
.pick-subscription-period
  q-btn-toggle(
    v-model="selectedMonths"
    spread
    no-caps
    rounded
    unelevated
    toggle-color="primary"
    color="white"
    text-color="primary"
    :options="toggleOptions"
  )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  usePickSubscriptionPeriod,
  type SubscriptionPeriodMonths,
} from '../model'

interface Props {
  modelValue?: SubscriptionPeriodMonths
}
const props = withDefaults(defineProps<Props>(), { modelValue: 1 })
const emit = defineEmits<{
  (e: 'update:modelValue', months: SubscriptionPeriodMonths): void
}>()

const { selectedMonths, options } = usePickSubscriptionPeriod(props.modelValue)

const toggleOptions = computed(() =>
  options.map((o) => ({ label: o.label, value: o.months })),
)

import { watch } from 'vue'
watch(selectedMonths, (v) => emit('update:modelValue', v))
watch(
  () => props.modelValue,
  (v) => {
    if (v && v !== selectedMonths.value) selectedMonths.value = v
  },
)
</script>

<style lang="scss" scoped>
.pick-subscription-period {
  width: 100%;
}
</style>
