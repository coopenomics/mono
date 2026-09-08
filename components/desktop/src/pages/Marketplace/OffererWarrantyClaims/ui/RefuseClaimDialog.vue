<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { BaseCard, BaseInput } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { refuseSupplierClaim, type MarketplaceSupplierClaimView } from '../api';

/**
 * Отказ поставщика по гарантийной претензии (99D-13). Причина обязательна:
 * кооператив увидит её при решении, идти ли в суд. Сумма после отказа
 * учитывается как отказанная и из выплат не удерживается.
 */

const props = defineProps<{
  modelValue: boolean;
  claim: MarketplaceSupplierClaimView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'decided'): void;
}>();

const reason = ref('');
const submitting = ref(false);

watch(
  () => [props.modelValue, props.claim?.id],
  ([visible]) => {
    if (visible) reason.value = '';
  },
);

const confirmDisabled = computed(() => submitting.value || !reason.value.trim());

async function confirm(): Promise<void> {
  if (!props.claim || !reason.value.trim()) return;
  submitting.value = true;
  try {
    await refuseSupplierClaim(props.claim.id, reason.value.trim());
    SuccessAlert('Отказ по претензии зафиксирован.');
    emit('decided');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось зафиксировать отказ');
  } finally {
    submitting.value = false;
  }
}
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  :title="claim ? `Отказ по претензии ${claim.id.slice(0, 8)}` : 'Отказ по претензии'"
  :lead-text="claim ? `${claim.product_name || 'Товар'} · ${formatAsset2Digits(claim.amount)} ₽` : ''"
  kind="danger"
  confirm-label="Отказать по претензии"
  cancel-label="Закрыть"
  :loading="submitting"
  :disable-confirm="confirmDisabled"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="emit('update:modelValue', false)"
)
  template(#default v-if="claim")
    .mp-claim-refuse
      BaseCard.q-mb-md(title='Причина отказа')
        BaseInput(
            v-model="reason"
            type="textarea"
            autogrow
            counter
            maxlength="500"
            label="Почему вы не признаёте претензию"
          )
      .banner.banner--warn
        q-icon.banner__icon(name="info", size="18px")
        .banner__body Сумма претензии останется учтённой как отказанная — кооператив вправе обратиться в суд. Из выплат она удерживаться не будет.
</template>
