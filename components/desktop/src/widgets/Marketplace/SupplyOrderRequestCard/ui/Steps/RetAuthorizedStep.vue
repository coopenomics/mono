<template lang="pug">
q-step(
  :name="8"
  title="Авторизация возврата"
  icon="fa-solid fa-gavel"
  :done="currentStep > 8"
  :active-icon="currentStep === 8 ? 'fa-solid fa-scale-balanced' : undefined"
)
  .text-body2.q-mb-md Совет кооператива рассматривает заявление на возврат паевого взноса имуществом.

  template(v-if="currentStep === 8")
    template(v-if="iAmAuthorizer")
      q-banner.bg-orange-1.text-orange-9.q-mb-md(rounded)
        template(#avatar)
          q-icon(name="fa-solid fa-exclamation-triangle" color="orange")
        | Заявление ожидает решения совета. Голосование происходит через пункт повестки дня.

    template(v-else)
      q-banner.bg-grey-2.q-mb-md(rounded)
        template(#avatar)
          q-icon(name="fa-solid fa-hourglass-half" color="grey")
        | Ожидаем решения совета по заявлению на возврат.

  template(v-else-if="currentStep > 8")
    q-chip(color="green" text-color="white" icon="fa-solid fa-check") Возврат авторизован
</template>

<script setup lang="ts">
import type { IRequestData } from 'src/entities/Request/model'

defineProps<{
  request: IRequestData
  iAmAuthorizer: boolean
  currentStep: number
}>()
</script>
