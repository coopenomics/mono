<template lang="pug">
.cooperative-onboarding-gate
  template(v-if='isLoading && !state')
    .full-width.q-pa-lg.flex.flex-center
      q-spinner(size='32px', color='primary')
  template(v-else-if='error')
    BaseBanner.q-mb-md(variant='neg')
      | Не удалось загрузить состояние онбординга: {{ error }}
      template(#action)
        BaseButton(variant='ghost', size='sm', @click='load') Повторить
  template(v-else-if='!allDone')
    slot(name='onboarding', :steps='steps', :on-propose='handlePropose', :all-done='allDone', :expires-at='expiresAt', :is-expired='isExpired')
      CooperativeOnboardingSteps(:steps='steps', @propose='handlePropose')
  template(v-else)
    slot
</template>

<script lang="ts" setup>
import { onMounted, computed } from 'vue'
import { BaseBanner, BaseButton } from 'src/shared/ui/base'
import { useExtensionCooperativeOnboarding } from '../model/composable'
import CooperativeOnboardingSteps from './CooperativeOnboardingSteps.vue'
import type { IExtensionOnboardingStepState } from '../model/types'

const props = defineProps<{
  extension: string
}>()

const emit = defineEmits<{
  propose: [step: IExtensionOnboardingStepState]
  ready: []
}>()

const {
  state,
  isLoading,
  error,
  steps,
  allDone,
  expiresAt,
  isExpired,
  load,
} = useExtensionCooperativeOnboarding(() => props.extension)

onMounted(() => {
  void load()
})

function handlePropose(step: IExtensionOnboardingStepState) {
  emit('propose', step)
}

const _onReady = computed(() => {
  if (allDone.value) emit('ready')
  return allDone.value
})
void _onReady.value
</script>
