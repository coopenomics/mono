<template lang="pug">
//- Привязка наклеенной этикетки к позиции склада: оператор сканирует её
//- камерой или USB-сканером либо вводит код руками. Код не придумывается —
//- это код напечатанной и наклеенной этикетки (решение владельца 19.11.2026).
//- Считанный код привязывается сразу, отдельной кнопки «Привязать» нет.
BaseDialog(
  :model-value='modelValue',
  :title='$t("marketplace.operatorInventoryLabeling.bindLabelDialogTitle")',
  size='sm',
  @update:model-value='(v) => emit("update:modelValue", v)'
)
  .label-bind
    .label-bind__note(v-if='item')
      | {{ $t('marketplace.operatorInventoryLabeling.bindLabelNote', { productName: item.product_name_snapshot || $t('marketplace.operatorInventoryLabeling.productFallback') }) }}
    CodeScanner(
      v-if='modelValue',
      :formats='BARCODE_FORMATS',
      :idle-caption='$t("marketplace.operatorInventoryLabeling.bindLabelIdleCaption")',
      :frame-hint='$t("marketplace.operatorInventoryLabeling.bindLabelFrameHint")',
      :start-label='$t("marketplace.operatorInventoryLabeling.bindLabelStartLabel")',
      :manual-label='$t("marketplace.operatorInventoryLabeling.bindLabelManualLabel")',
      manual-placeholder='4600000000000',
      :manual-button='$t("marketplace.operatorInventoryLabeling.bindLabelManualButton")',
      @scanned='bind'
    )
  template(#footer)
    BaseButton(variant='ghost', size='sm', :disabled='binding', @click='emit("update:modelValue", false)') {{ $t('common.action.close') }}
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { CodeScanner, BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner'
import { bindInventoryBarcode, type MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'
import { t } from 'src/shared/i18n'

const props = defineProps<{
  modelValue: boolean
  /** Позиция склада, к которой привязывается этикетка. */
  item: MarketplaceInventoryItemView | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'bound', updated: MarketplaceInventoryItemView[]): void
}>()

const binding = ref(false)

async function bind(raw: string): Promise<void> {
  const code = raw.trim()
  if (!props.item || !code || binding.value) return
  binding.value = true
  try {
    const updated = await bindInventoryBarcode({ inventory_id: props.item.id, barcode_value: code })
    SuccessAlert(t('marketplace.operatorInventoryLabeling.labelBoundMessage', { code }))
    emit('update:modelValue', false)
    emit('bound', updated)
  } catch (e) {
    FailAlert(e, t('marketplace.operatorInventoryLabeling.bindLabelError'))
  } finally {
    binding.value = false
  }
}
</script>

<style scoped lang="scss">
.label-bind {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }
}
</style>
