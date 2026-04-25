<template lang="pug">
div
  q-step(
    :name="8"
    title="Завершите заявку"
    icon="settings"
    :done="currentStep > 8"
  )
    span Пожалуйста, завершите заявку и разблокируйте деньги поставщика через {time}
    q-stepper-navigation.q-gutter-sm
      CompleteOnRequestButton(:request-id=Number("request.id") :coopname="request.coopname" :username="username")
      DisputeOnRequestButton(v-if="iAmReciever && isActive" :request-id=Number("request.id") :coopname="request.coopname" :username="username")

</template>

<script setup lang="ts">
  import { CompleteOnRequestButton } from 'src/features/Request/CompleteOnRequest'
  import { DisputeOnRequestButton } from 'src/features/Request/DisputeOnRequest'
  import { computed, withDefaults } from 'vue'
  import type { IStepProps } from '../../model'
  import { useSessionStore } from 'src/entities/Session'
  const session = useSessionStore()
  const username = computed(() => session.username)

  const props = withDefaults(defineProps<IStepProps>(), {})
  const isActive = computed(() => props.request.status === 'recieved2') //TODO && и гарантийный срок вышел!
  const currentStep = computed(()=> props.currentStep)
</script>
