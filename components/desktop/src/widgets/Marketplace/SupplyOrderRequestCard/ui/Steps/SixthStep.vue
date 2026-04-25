<script setup lang="ts">
  import { CancelButton } from 'src/features/Request/CancelRequest'
  import { RecieveOnRequestButton } from 'src/features/Request/RecieveOnRequest'
  import { computed, withDefaults } from 'vue'
  import type { IStepProps } from '../../model'
  import { useSessionStore } from 'src/entities/Session'
  const session = useSessionStore()
  const username = computed(() => session.username)

  const props = withDefaults(defineProps<IStepProps>(), {})
  const isActive = computed(() => props.request.status === 'delivered')
  const currentStep = computed(()=> props.currentStep)
</script>

<template lang="pug">
div
  template(v-if="props.iAmReciever")
    q-step(
      :name="6"
      title="Получите имущество из участка"
      icon="settings"
      :done="currentStep > 6"
    )
      span Пожалуйста, получите имущество из участка {point} в течении {time}
      q-stepper-navigation.q-gutter-sm
        CancelButton(v-if="iAmReciever && isActive" :request-id=Number("request.id") :coopname="request.coopname" :username="username")
        RecieveOnRequestButton(v-if="iAmReciever && isActive" :request-id=Number("request.id") :coopname="request.coopname" :username="username")

  template(v-else)
    q-step(
      :name="6"
      title="Заказчик получает имущество"
      icon="settings"
      :done="currentStep > 6"
    )
      span Заказчик получит имущество не позднее чем через {time}
</template>
