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
        q-input(
          v-model="amountRub"
          type="number"
          min="1"
          step="0.01"
          label="Сумма конвертации, ₽"
          :rules="[(v) => Number(v) > 0 || 'Введите сумму больше нуля']"
          outlined
        ).q-mb-md

    div(v-else-if="step === 2")
      Loader(v-if="isLoading" :text="'Формируем документ...'")
      div(v-else-if="generated")
        DocumentHtmlReader(:html="generated.html")
        div.q-mt-md
          q-btn(@click="step = 1" flat) назад
          q-btn(@click="onSign" color="primary" :loading="isSubmitting") подписать
</template>

<script setup lang="ts">
import { BaseDialog } from 'src/shared/ui/base/BaseDialog'
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

const onGenerate = async () => {
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
