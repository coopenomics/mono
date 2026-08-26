<template lang="pug">
BaseDialog(
  v-model="isVisible"
  title="Пополнение кошелька членских взносов"
  size="md"
  :close-on-backdrop="false"
  :close-on-escape="false"
)
  //- Объяснение в одну фразу: что произойдёт с деньгами. Заявление формируется
  //- и подписывается самим действием, отдельным шагом его не показываем — текст
  //- заявления задан шаблоном реестра и от пайщика в нём ничего не зависит,
  //- кроме суммы, а подписанный экземпляр остаётся в реестре документов.
  p.convert-billing__lead
    | Паевой взнос по программе «Цифровой Кошелек» транслируется в членский
    | взнос по соглашению о присоединении к платформе «Кооперативная
    | Экономика» — из него оплачиваются подписки кооператива.

  AmountInput(
    v-model="amountRub"
    label="Сумма"
    :symbol="symbol"
    :error="amountError"
  )

  template(#footer)
    BaseButton(
      variant="ghost"
      type="button"
      :disabled="isSubmitting"
      @click="onCancel"
    ) Отменить
    BaseButton(
      variant="primary"
      type="button"
      :loading="isSubmitting"
      :disabled="!canSubmit"
      @click="onSubmit"
    ) Пополнить
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseDialog, BaseButton } from 'src/shared/ui/base'
import { AmountInput } from 'src/shared/ui/domain'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { useSystemStore } from 'src/entities/System/model'
import { useConvertToBilling } from '../model'

const { isVisible, isSubmitting, amountRub, convert } = useConvertToBilling()

const system = useSystemStore()
const symbol = computed(() => system.info.symbols?.root_govern_symbol || 'RUB')

// Подсказка под полем резервируется AmountInput'ом — ошибка не сдвигает форму.
const amountError = computed(() =>
  amountRub.value !== null && amountRub.value <= 0 ? 'Введите сумму больше нуля' : '',
)

const canSubmit = computed(() => (amountRub.value ?? 0) > 0)

const onSubmit = async () => {
  if (!canSubmit.value) return
  try {
    await convert()
    SuccessAlert('Кошелёк пополнен: паевой взнос транслирован в членский')
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
</style>
