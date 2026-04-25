<template lang="pug">
div
  template(v-if="props.iAmAuthorizer")
    q-step(
      :name="5"
      title="Ожидаем доставку до ПВЗ"
      icon="settings"
      :done="currentStep > 5"
    )
      span Пожалуйста, организуйте доставку до ПВЗ, если это требуется, и подтвердите готовность выдать имущество заказчику.
      q-stepper-navigation.q-gutter-sm
        DeliverOnRequestButton(v-if="iAmAuthorizer && isActive" :request-id=Number("request.id") :coopname="request.coopname" :username="username")

  template(v-else)
    q-step(
      :name="4"
      title="Ожидаем прибытие имущества на ПВЗ"
      icon="settings"
      :done="currentStep > 5"
    )
      span Ожидаем, когда уполномоченный кооператива доставит имущество до ПВЗ.
  </template>
<script setup lang="ts">
  import { DeliverOnRequestButton } from 'src/features/Request/DeliverOnRequest'
  import { computed, withDefaults } from 'vue'
  import type { IStepProps } from '../../model'
  import { useSessionStore } from 'src/entities/Session'
  const session = useSessionStore()
  const username = computed(() => session.username)

  const props = withDefaults(defineProps<IStepProps>(), {})
  const isActive = computed(() => props.request.status === 'supplied2')
  const currentStep = computed(()=> props.currentStep)
</script>
