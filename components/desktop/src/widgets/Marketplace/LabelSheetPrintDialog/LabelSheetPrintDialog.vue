<template lang="pug">
//- Печать листа этикеток со штрих-кодами (для нарезки и наклейки). Этикетка
//- печатается заранее и ещё ни к чему не привязана: её клеят на имущество и
//- привязывают сканером. Одно окно на раскладку и на склад.
BaseDialog(
  :model-value='modelValue',
  :title='$t("marketplace.operatorInventoryLabeling.printDialogTitle")',
  size='sm',
  @update:model-value='(v) => emit("update:modelValue", v)'
)
  .label-print
    .label-print__note
      | {{ $t('marketplace.operatorInventoryLabeling.printNoteLine1') }}
      | {{ $t('marketplace.operatorInventoryLabeling.printNoteLine2') }}
    BaseInput(
      v-model.number='count',
      type='number',
      :label='$t("marketplace.operatorInventoryLabeling.printCountLabel")',
      @keydown.enter='print'
    )
  template(#footer)
    BaseButton(variant='ghost', size='sm', @click='emit("update:modelValue", false)') {{ $t('common.action.cancel') }}
    BaseButton(variant='primary', size='sm', :disabled='!count || count < 1', @click='print') {{ $t('marketplace.operatorInventoryLabeling.printSubmitButton') }}
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base'
import { printBarcodeSheet } from 'src/shared/lib/marketplace'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const count = ref<number | null>(24)

function print(): void {
  const n = Math.trunc(Number(count.value) || 0)
  if (n < 1) return
  emit('update:modelValue', false)
  printBarcodeSheet(n)
}
</script>

<style scoped lang="scss">
.label-print {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }
}
</style>
