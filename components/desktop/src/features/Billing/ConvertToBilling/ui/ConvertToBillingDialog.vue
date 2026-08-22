<template lang="pug">
BaseDialog(
  v-model="isVisible"
  title="Конвертация паевого взноса в членский"
  :close-on-backdrop="false"
  :close-on-escape="false"
)
  div.q-pa-md
    div(v-if="step === 1")
      p
        | Паевой взнос (возвратный) транслируется в членский (целевой) на ваш
        | персональный биллинг-кошелёк для оплаты инфраструктурных подписок.
        | Конвертация подтверждается подписанным заявлением.
      Form(
        :handler-submit="onGenerate"
        :is-submitting="isLoading"
        :showSubmit="!isLoading"
        :showCancel="true"
        :button-submit-txt="'Сформировать заявление'"
        @cancel="onCancel"
      )
        BaseInput(
          v-model="amountRub"
          type="number"
          label="Сумма конвертации, ₽"
          :error="amountError"
          required
        ).q-mb-md

    div(v-else-if="step === 2")
      Loader(v-if="isLoading" :text="'Формируем документ...'")
      div(v-else-if="generated")
        DocumentHtmlReader(:html="generated.html")
        div.q-mt-md.row.q-gutter-sm
          BaseButton(variant="ghost" size="md" @click="step = 1") Назад
          BaseButton(variant="primary" size="md" :loading="isSubmitting" @click="onSign") Подписать
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseDialog, BaseButton, BaseInput } from 'src/shared/ui/base'
import { Form } from 'src/shared/ui/Form'
import { Loader } from 'src/shared/ui/Loader'
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { useConvertToBilling } from '../model'

const {
  isVisible,
  isLoading,
  isSubmitting,
  step,
  amountRub,
  generated,
  generate,
  sign,
} = useConvertToBilling()

// Подсказка под полем резервируется BaseInput'ом — ошибка не сдвигает форму.
const amountError = computed(() =>
  amountRub.value !== '' && Number(amountRub.value) <= 0 ? 'Введите сумму больше нуля' : '',
)

const onGenerate = async () => {
  if (!(Number(amountRub.value) > 0)) {
    FailAlert('Введите сумму больше нуля')
    return
  }
  try {
    await generate()
  } catch (e: any) {
    FailAlert(e)
  }
}

const onSign = async () => {
  try {
    await sign()
    SuccessAlert('Паевой взнос сконвертирован в членский')
  } catch (e: any) {
    FailAlert(e)
  }
}

const onCancel = () => {
  isVisible.value = false
}
</script>
<style>
.digital-document .header {
  text-align: center;
}
</style>
