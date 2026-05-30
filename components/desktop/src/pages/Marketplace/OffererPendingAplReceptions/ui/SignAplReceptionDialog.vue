<script setup lang="ts">
import { computed, ref } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import {
  fetchSupplierSignablePayloads,
  signAsSupplier,
  type MarketplaceAplReceptionView,
  type SignedDocumentInput,
} from '../api';

/**
 * Первая подпись поставщика на акте приёмки (on-chain `signsupp`).
 *
 * Поставщик подписывает один канонический акт (registry_id=1102) на
 * каждый Order группы своим ключом из активной сессии — он же владелец
 * Offer'ов АПП. Backend верифицирует подписи и по meta.order_id
 * привязывает каждый акт к Order'у партии, после чего АПП переходит в
 * PENDING_CHAIRMAN_RECEPTION_SIGN.
 */

const props = defineProps<{
  modelValue: boolean;
  reception: MarketplaceAplReceptionView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'signed'): void;
}>();

const globalStore = useGlobalStore();
const signing = ref(false);

const VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};
const variantLabel = computed(() =>
  props.reception ? (VARIANT_LABEL[props.reception.variant] ?? props.reception.variant) : '',
);

async function confirm(): Promise<void> {
  if (!props.reception) return;

  const wif = globalStore.wif?.toString();
  if (!wif) {
    FailAlert(new Error('Приватный ключ поставщика не найден. Войдите в кооператив.'));
    return;
  }

  signing.value = true;
  try {
    const payloads = await fetchSupplierSignablePayloads(props.reception.id);
    if (payloads.length === 0) {
      throw new Error('Backend не вернул ни одного акта для подписи.');
    }

    const signer = new Classes.Document(wif);
    const signed_documents: SignedDocumentInput[] = [];
    for (const payload of payloads) {
      const signed = await signer.signDocument(payload, props.reception.offerer_account, 1);
      signed_documents.push(signed);
    }

    await signAsSupplier(props.reception.id, signed_documents);
    SuccessAlert('Акт приёмки подписан. Ожидается закрывающая подпись председателя КУ.');
    emit('signed');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось подписать акт приёмки');
  } finally {
    signing.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Подпись акта приёмки"
  maximized
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  .sign-apl
    .text-caption.text-grey(v-if="reception")
      | КУ {{ reception.braname }} · {{ variantLabel }}

    .text-h6(v-if="reception")
      | Сумма к приёмке: {{ formatAsset2Digits(reception.total_amount) }} ₽

    .text-body2.text-grey
      | После вашей подписи акт уходит на финализирующую подпись председателя КУ.

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="primary", :loading="signing", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="16px")
      | Подписать
</template>

<style scoped lang="scss">
.sign-apl {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
</style>
