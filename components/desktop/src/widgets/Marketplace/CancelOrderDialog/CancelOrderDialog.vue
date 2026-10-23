<script setup lang="ts">
import { ref } from 'vue';
import { BaseDialog, BaseButton } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { cancelOrder } from 'src/pages/Marketplace/MyOrders/api';
import { t } from 'src/shared/i18n';

/**
 * Подтверждение отмены заказа заказчиком (до акцепта поставщиком — окно
 * бесплатной отмены на контракте, `status === 'ACTIVE'`). Общий диалог для
 * списка заказов (MyOrdersPage) и страницы деталей (OrdererOrderDetailPage) —
 * канон BaseDialog вместо разношёрстных Dialog.create в двух местах.
 */
const props = defineProps<{
  modelValue: boolean;
  orderId: string;
  /** Готовое описание строки заказа для подтверждения («№ ..., 1×упак. 1 л, 100,00 ₽»). */
  message: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'cancelled'): void;
}>();

const cancelling = ref(false);

function close(): void {
  if (cancelling.value) return;
  emit('update:modelValue', false);
}

async function confirm(): Promise<void> {
  cancelling.value = true;
  try {
    const result = await cancelOrder(props.orderId);
    SuccessAlert(t('marketplace.cancelOrderDialog.cancelledMessage', { txHash: result.tx_hash.slice(0, 8) }));
    emit('update:modelValue', false);
    emit('cancelled');
  } catch (e) {
    FailAlert(e);
  } finally {
    cancelling.value = false;
  }
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue",
  :title="$t('marketplace.cancelOrderDialog.dialogTitle')",
  size="sm",
  :close-on-backdrop="!cancelling",
  :close-on-escape="!cancelling",
  @update:model-value="(v) => (v ? undefined : close())"
)
  template(#default)
    p.cancel-order-dialog__message {{ $t('marketplace.cancelOrderDialog.confirmText', { message }) }}
  template(#footer)
    BaseButton(variant="ghost", :disabled="cancelling", @click="close") {{ $t('marketplace.cancelOrderDialog.keepButton') }}
    BaseButton(variant="danger", :loading="cancelling", @click="confirm") {{ $t('marketplace.cancelOrderDialog.cancelButton') }}
</template>

<style scoped lang="scss">
.cancel-order-dialog__message {
  color: var(--p-ink-2);
  margin: 0;
}
</style>
