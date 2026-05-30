<script setup lang="ts">
import { computed, ref } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import {
  fetchChairmanSignablePayloads,
  signAsChairman,
  type MarketplaceAplReceptionView,
  type SignedDocumentInput,
} from '../api';

/**
 * Закрывающая подпись председателя кооперативного участка на акте
 * приёмки (on-chain `signchair`).
 *
 * Backend отдаёт по каждому Order группы агрегат: исходный документ плюс
 * документ с уже наложенной подписью поставщика. Председатель накладывает
 * свою подпись (signatureId=2) поверх подписи поставщика тем же ключом
 * активной сессии — документ не перегенерируется. После закрывающей
 * подписи партия принимается в кооператив.
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
    FailAlert(new Error('Приватный ключ председателя не найден. Войдите в кооператив.'));
    return;
  }

  signing.value = true;
  try {
    const aggregates = await fetchChairmanSignablePayloads(props.reception.id);
    if (aggregates.length === 0) {
      throw new Error('Backend не вернул ни одного акта для закрывающей подписи.');
    }

    const signer = new Classes.Document(wif);
    const signed_documents: SignedDocumentInput[] = [];
    for (const aggregate of aggregates) {
      const signed = await signer.signDocument(
        aggregate.rawDocument,
        globalStore.username,
        2,
        [aggregate.document],
      );
      signed_documents.push(signed);
    }

    await signAsChairman(props.reception.id, signed_documents);
    SuccessAlert('Акт приёмки закрыт подписью председателя. Партия принята в кооператив.');
    emit('signed');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось закрыть акт приёмки');
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
  title="Закрывающая подпись акта приёмки"
  maximized
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .mp-sign-apl-chairman
    .text-caption.text-grey(v-if="reception")
      | КУ {{ reception.braname }} · {{ variantLabel }}

    .text-h6(v-if="reception")
      | Сумма к приёмке: {{ formatAsset2Digits(reception.total_amount) }} ₽

    .text-body2.text-grey
      | После закрывающей подписи партия принимается в кооператив.

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="primary", :loading="signing", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="16px")
      | Подписать председателем
</template>

<style scoped lang="scss">
.mp-sign-apl-chairman {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
</style>
