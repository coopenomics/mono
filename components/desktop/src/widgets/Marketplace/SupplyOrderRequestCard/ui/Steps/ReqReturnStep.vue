<template lang="pug">
q-step(
  :name="7"
  title="Запрос возврата"
  icon="fa-solid fa-file-signature"
  :done="currentStep > 7"
  :active-icon="currentStep === 7 ? 'fa-solid fa-pen' : undefined"
)
  .text-body2.q-mb-md Имущество доставлено. Заказчику необходимо подать заявление на возврат паевого взноса имуществом для получения решения совета.

  template(v-if="currentStep === 7")
    template(v-if="iAmReciever")
      q-banner.bg-blue-1.text-blue-9.q-mb-md(rounded)
        template(#avatar)
          q-icon(name="fa-solid fa-info-circle" color="blue")
        | Подайте заявление на возврат паевого взноса имуществом. После подачи совет кооператива рассмотрит заявление и примет решение.

      q-btn(
        color="primary"
        label="Подать заявление на возврат"
        icon="fa-solid fa-paper-plane"
        no-caps
        @click="$emit('reqReturn', request)"
        :loading="loading"
      )

    template(v-else)
      q-banner.bg-grey-2.q-mb-md(rounded)
        template(#avatar)
          q-icon(name="fa-solid fa-hourglass-half" color="grey")
        | Ожидаем подачи заявления на возврат от заказчика.

  template(v-else-if="currentStep > 7")
    q-chip(color="green" text-color="white" icon="fa-solid fa-check") Заявление подано
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IRequestData } from 'src/entities/Request/model'

defineProps<{
  request: IRequestData
  iAmReciever: boolean
  username: string
  currentStep: number
}>()

defineEmits(['reqReturn'])
const loading = ref(false)
</script>
