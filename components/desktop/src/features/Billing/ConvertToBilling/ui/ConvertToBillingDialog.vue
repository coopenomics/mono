<template lang="pug">
BaseDialog(
  v-model="isVisible"
  title="Конвертация паевого взноса в членский"
  :size="step === 1 ? 'md' : 'lg'"
  :close-on-backdrop="false"
  :close-on-escape="false"
)
  //- Шаг 1 — сумма. Одно объяснение в одну фразу: юридическую сторону
  //- (заявление, подпись) пайщик увидит на следующем шаге целиком, дублировать
  //- её текстом здесь незачем.
  template(v-if="step === 1")
    p.convert-billing__lead
      | Паевой взнос транслируется в членский на ваш персональный
      | биллинг-кошелёк для оплаты инфраструктурных подписок.
    AmountInput(
      v-model="amountRub"
      label="Сумма"
      :symbol="symbol"
      :error="amountError"
    )

  //- Шаг 2 — заявление. Документ прокручивается внутри своей области, чтобы
  //- кнопка подписи оставалась на виду и на длинных текстах.
  template(v-else)
    Loader(v-if="isLoading" :text="'Формируем документ...'")
    .convert-billing__doc(v-else-if="generated")
      DocumentHtmlReader(:html="generated.html")

  template(#footer)
    template(v-if="step === 1")
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="isLoading"
        @click="onCancel"
      ) Отменить
      BaseButton(
        variant="primary"
        type="button"
        :loading="isLoading"
        :disabled="!canGenerate"
        @click="onGenerate"
      ) Сформировать заявление
    template(v-else)
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="isSubmitting"
        @click="step = 1"
      ) Назад
      BaseButton(
        variant="primary"
        type="button"
        :loading="isSubmitting"
        @click="onSign"
      ) Подписать
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseDialog, BaseButton } from 'src/shared/ui/base'
import { AmountInput } from 'src/shared/ui/domain'
import { Loader } from 'src/shared/ui/Loader'
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { useSystemStore } from 'src/entities/System/model'
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

const system = useSystemStore()
const symbol = computed(() => system.info.symbols?.root_govern_symbol || 'RUB')

// Подсказка под полем резервируется AmountInput'ом — ошибка не сдвигает форму.
const amountError = computed(() =>
  amountRub.value !== null && amountRub.value <= 0 ? 'Введите сумму больше нуля' : '',
)

const canGenerate = computed(() => (amountRub.value ?? 0) > 0)

const onGenerate = async () => {
  if (!canGenerate.value) return
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

<style scoped>
.convert-billing__lead {
  margin: 0 0 var(--p-4);
}
.convert-billing__doc {
  max-height: 60vh;
  overflow-y: auto;
}
</style>

<style>
.digital-document .header {
  text-align: center;
}
</style>
