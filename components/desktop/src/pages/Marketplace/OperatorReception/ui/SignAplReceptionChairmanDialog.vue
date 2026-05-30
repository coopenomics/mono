<script setup lang="ts">
import { computed, ref } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { ReceptionLinesTable, type ReceptionLineRow } from 'src/widgets/Marketplace/ReceptionLinesTable';
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
const previewHtml = ref<string>('');
const previewLoading = ref(false);

const VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};
const variantLabel = computed(() =>
  props.reception ? (VARIANT_LABEL[props.reception.variant] ?? props.reception.variant) : '',
);

// Председатель закрывает акт на УЖЕ зафиксированном факте — таблица сверки
// строго на чтение (оператор зафиксировал кол-во/цену при открытии приёмки).
const offererLabel = computed(() =>
  props.reception ? (props.reception.offerer_name || props.reception.offerer_account) : '',
);

const lines = computed<ReceptionLineRow[]>(() =>
  (props.reception?.fact_quantity_per_order ?? []).map((f) => ({
    product_name: f.product_name,
    fact_quantity: f.fact_quantity,
    unit_of_measure: f.unit_of_measure,
    fact_unit_price: f.fact_unit_price,
  })),
);

async function loadPreview(): Promise<void> {
  if (!props.reception) return;
  previewLoading.value = true;
  try {
    const aggregates = await fetchChairmanSignablePayloads(props.reception.id);
    previewHtml.value = aggregates.map((a) => a.rawDocument.html).join('<hr/>');
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать акт приёмки');
  } finally {
    previewLoading.value = false;
  }
}

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
      | КУ {{ reception.braname }} · {{ variantLabel }} · поставщик {{ offererLabel }}

    ReceptionLinesTable(v-if="reception", :rows="lines")

    .text-h6(v-if="reception")
      | Сумма к приёмке: {{ formatAsset2Digits(reception.total_amount) }} ₽

    .mp-sign-apl-chairman__preview-actions
      BaseButton(variant="ghost", size="sm", :loading="previewLoading", @click="loadPreview")
        template(#icon-left)
          q-icon(name="description", size="16px")
        | Показать акт

    q-card(v-if="previewHtml", flat, bordered).mp-sign-apl-chairman__preview
      q-card-section.q-pa-md
        div(v-html="previewHtml")

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

  &__preview-actions {
    display: flex;
    justify-content: flex-start;
  }

  &__preview {
    max-height: 60vh;
    overflow: auto;
  }
}
</style>
