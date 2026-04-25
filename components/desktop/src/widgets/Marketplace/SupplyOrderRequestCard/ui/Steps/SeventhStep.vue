<script setup lang="ts">
import { CancelButton } from 'src/features/Request/CancelRequest'
import { ConfirmRecieveOnRequestButton } from 'src/features/Request/ConfirmRecieveOnRequest'
import { computed, withDefaults } from 'vue'
import type { IStepProps } from '../../model'
import { useSessionStore } from 'src/entities/Session'
const session = useSessionStore()
const username = computed(() => session.username)

const props = withDefaults(defineProps<IStepProps>(), {})
const isActive = computed(() => props.request.status === 'recieved1')
const currentStep = computed(()=> props.currentStep)
</script>

<template lang="pug">
div
  template(v-if="props.iAmAuthorizer")
    q-step(
      :name="7"
      title="Подтвердите выдачу имущества"
      icon="settings"
      :done="currentStep > 7"
    )
      span Пожалуйста, подтвердите выдачу имущества по заказу в течении {time}
      q-stepper-navigation.q-gutter-sm
        CancelButton(v-if="iAmAuthorizer && isActive" :request-id="Number(request.id)" :coopname="request.coopname" :username="username")
        ConfirmRecieveOnRequestButton(v-if="iAmAuthorizer && isActive" :request-id="Number(request.id)" :coopname="request.coopname" :username="username")

  template(v-else)
    q-step(
      :name="7"
      title="Формируются закрывающие документы"
      icon="settings"
      :done="currentStep > 7"
    )
      span Ожидаем цифровую подпись уполномоченного на акте приёма-передачи имущества
</template>
