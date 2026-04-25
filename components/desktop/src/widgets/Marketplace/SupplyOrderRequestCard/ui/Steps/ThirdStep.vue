<script setup lang="ts">
import { CancelButton } from 'src/features/Request/CancelRequest'
import { SupplyOnRequestButton } from 'src/features/Request/SupplyOnRequest'
import { computed, withDefaults } from 'vue'
import type { IStepProps } from '../../model'

import { useSessionStore } from 'src/entities/Session'
const session = useSessionStore()
const username = computed(() => session.username)

const props = withDefaults(defineProps<IStepProps>(), {})
const currentStep = computed(()=> props.currentStep)
const isActive = computed(() => props.request.status === 'authorized')
</script>

<template lang="pug">
div
  template(v-if="iAmAuthorizer")
    q-step(
      :name="3"
      title="Примите имущество"
      icon="settings"
      :done="currentStep > 3"
    )
      span Пожалуйста, осмотрите имущество и примите его в кооператив, оставив подпись на акте приёма-передачи.

      q-stepper-navigation.q-gutter-sm
        CancelButton(:request-id="Number(request.id)" :coopname="request.coopname" :username="username")
        SupplyOnRequestButton(:request-id="Number(request.id)" :coopname="request.coopname" :username="username")

  template(v-else-if="iAmSupplier")
    q-step(
      :name="3"
      title="Доставьте имущество до участка"
      icon="settings"
      :done="currentStep > 3"
    )
      span Пожалуйста, доставьте имущество до ближайшего участка в течении {time} и покажите {QR}
      q-stepper-navigation.q-gutter-sm
        CancelButton(v-if="iAmSupplier && isActive" :request-id="Number(request.id)" :coopname="request.coopname" :username="username")


  template(v-else-if="iAmReciever")
    q-step(
      :name="3"
      title="Поставщик доставляет имущество"
      icon="settings"
      :done="currentStep > 3"
    )
      span Прямо сейчас поставщик везёт ваше имущество на участок и доставит его не позднее чем через {time}
</template>
