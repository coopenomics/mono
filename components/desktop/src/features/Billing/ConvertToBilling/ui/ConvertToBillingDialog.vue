<template lang="pug">
q-dialog(v-model="convert.isVisible.value" persistent :maximized="true")
  ModalBase(title="Конвертация паевого взноса в членский" :show_close="false")
    div.row.justify-center
      div(style="padding-bottom: 100px;").col-md-8.col-xs-12

        div(v-if="convert.step.value === 1")
          p.q-mt-lg
            | Паевой взнос (возвратный) транслируется в членский (целевой) на ваш
            | персональный биллинг-кошелёк для оплаты инфраструктурных подписок.
            | Конвертация подтверждается подписанным заявлением.
          Form(
            :handler-submit="onGenerate"
            :is-submitting="convert.isLoading.value"
            :showSubmit="!convert.isLoading.value"
            :showCancel="true"
            :button-submit-txt="'Сформировать заявление'"
            @cancel="onCancel"
          ).q-pa-md
            q-input(
              v-model="convert.amountRub.value"
              type="number"
              min="1"
              step="0.01"
              label="Сумма конвертации, ₽"
              :rules="[(v) => Number(v) > 0 || 'Введите сумму больше нуля']"
              outlined
            ).q-mb-md

        div(v-else-if="convert.step.value === 2")
          Loader(v-if="convert.isLoading.value" :text="'Формируем документ...'")
          div(v-else-if="convert.generated.value")
            DocumentHtmlReader(:html="convert.generated.value.html")
            div.q-mt-md
              q-btn(@click="convert.step.value = 1" flat) назад
              q-btn(@click="onSign" color="primary" :loading="convert.isSubmitting.value") подписать
</template>

<script setup lang="ts">
import { ModalBase } from 'src/shared/ui/ModalBase'
import { Form } from 'src/shared/ui/Form'
import { Loader } from 'src/shared/ui/Loader'
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { useConvertToBilling } from '../model'

const convert = useConvertToBilling()

const onGenerate = async () => {
  try {
    await convert.generate()
  } catch (e: any) {
    FailAlert(e)
  }
}

const onSign = async () => {
  try {
    await convert.sign()
    SuccessAlert('Паевой взнос сконвертирован в членский')
  } catch (e: any) {
    FailAlert(e)
  }
}

const onCancel = () => {
  convert.isVisible.value = false
}
</script>
<style>
.digital-document .header {
  text-align: center;
}
</style>
