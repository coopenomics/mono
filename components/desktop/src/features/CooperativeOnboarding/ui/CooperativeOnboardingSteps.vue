<template lang="pug">
.cooperative-onboarding-steps.q-gutter-md
  q-card(v-for='step in steps', :key='step.step_key', flat, bordered)
    q-card-section
      .row.items-center.no-wrap.q-gutter-sm
        q-icon(
          :name='step.done ? "task_alt" : "radio_button_unchecked"',
          :color='step.done ? "positive" : "grey-6"',
          size='28px'
        )
        .col
          .text-subtitle1 {{ step.default_title || step.step_key }}
          .text-caption.text-grey-7(v-if='step.hash')
            | hash: {{ step.hash.substring(0, 12) }}…
      .row.q-mt-sm(v-if='!step.done')
        q-btn(
          flat,
          dense,
          color='primary',
          icon='campaign',
          :label='proposeLabel',
          @click='emit("propose", step)'
        )
</template>

<script lang="ts" setup>
import type { IExtensionOnboardingStepState } from '../model/types'

withDefaults(
  defineProps<{
    steps: IExtensionOnboardingStepState[]
    proposeLabel?: string
  }>(),
  {
    proposeLabel: 'Создать предложение совету',
  }
)

const emit = defineEmits<{
  propose: [step: IExtensionOnboardingStepState]
}>()
</script>
