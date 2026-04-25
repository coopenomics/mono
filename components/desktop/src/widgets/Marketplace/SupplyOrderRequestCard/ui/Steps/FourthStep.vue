<script setup lang="ts">
  import { CancelButton } from 'src/features/Request/CancelRequest'
  import { ConfirmSupplyOnRequestButton } from 'src/features/Request/ConfirmSupplyOnRequest'
  import { computed, withDefaults } from 'vue'
  import type { IStepProps } from '../../model'
  import { useSessionStore } from 'src/entities/Session'
  const session = useSessionStore()
  const username = computed(() => session.username)

  const props = withDefaults(defineProps<IStepProps>(), {})
  const isActive = computed(() => props.request.status === 'supplied1')
  const currentStep = computed(()=> props.currentStep)
</script>

<template lang="pug">
div
  template(v-if="iAmSupplier")
    q-step(
      :name="4"
      title="Оставьте подпись на акте приёма-передачи"
      icon="settings"
      :done="currentStep > 4"
    )
      span Пожалуйста, подтвердите передачу имущества оставив подпись на акте приёма-передачи.
      q-stepper-navigation.q-gutter-sm
        CancelButton(v-if="iAmSupplier && isActive" :request-id=Number("request.id") :coopname="request.coopname" :username="username")
        ConfirmSupplyOnRequestButton(:request-id=Number("request.id") :coopname="request.coopname" :username="username")

  template(v-else)
    q-step(
      :name="4"
      title="Ожидаем подтверждение поставщика"
      icon="settings"
      :done="currentStep > 4"
    )
      span Ожидаем, когда поставщик оставит свою цифровую подпись на акте приёма-передачи имущества.
</template>
