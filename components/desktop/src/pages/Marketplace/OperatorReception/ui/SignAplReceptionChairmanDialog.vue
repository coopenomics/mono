<script setup lang="ts">
import { computed, ref } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
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

const ordersCount = computed(() => props.reception?.fact_quantity_per_order?.length ?? 0);

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
q-dialog(
  :model-value="modelValue"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  q-card.mp-sign-apl-chairman(style="min-width: 420px; max-width: 560px")
    q-card-section
      .text-h6 Закрывающая подпись акта приёмки
      .text-caption.text-grey(v-if="reception")
        | АПП {{ reception.id.slice(0, 8) }} · КУ {{ reception.braname }} · {{ variantLabel }}

    q-card-section.q-pt-none
      q-banner.q-mb-md(rounded class="bg-primary text-white")
        | Поставщик уже подписал {{ ordersCount }} акт(ов) приёмки. Вы накладываете закрывающую подпись председателя поверх подписи поставщика ключом текущей сессии — документ не перегенерируется. После подписи партия принимается в кооператив.
      .text-body2(v-if="reception")
        | Сумма к приёмке: {{ reception.total_amount }} ₽

    q-card-actions(align="right")
      q-btn(flat no-caps label="Отмена" :disable="signing" @click="cancel")
      q-btn(
        unelevated
        no-caps
        color="primary"
        label="Подписать председателем"
        :loading="signing"
        @click="confirm"
      )
</template>

<style scoped lang="scss">
.mp-sign-apl-chairman {
  display: flex;
  flex-direction: column;
}
</style>
