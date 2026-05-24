<script setup lang="ts">
import { computed, ref } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
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

const ordersCount = computed(() => props.reception?.fact_quantity_per_order?.length ?? 0);

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
q-dialog(
  :model-value="modelValue"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  q-card.mp-sign-apl(style="min-width: 420px; max-width: 560px")
    q-card-section
      .text-h6 Подпись акта приёмки
      .text-caption.text-grey(v-if="reception")
        | АПП {{ reception.id.slice(0, 8) }} · КУ {{ reception.braname }} · вариант {{ reception.variant }}

    q-card-section.q-pt-none
      q-banner.q-mb-md(rounded class="bg-primary text-white")
        | Вы подписываете {{ ordersCount }} акт(ов) приёмки ключом текущей сессии как поставщик-владелец Offer'ов. После подписи акты уходят на закрывающую подпись председателя КУ.
      .text-body2(v-if="reception")
        | Сумма к приёмке: {{ reception.total_amount }} ₽

    q-card-actions(align="right")
      q-btn(flat no-caps label="Отмена" :disable="signing" @click="cancel")
      q-btn(
        unelevated
        no-caps
        color="primary"
        label="Подписать"
        :loading="signing"
        @click="confirm"
      )
</template>

<style scoped lang="scss">
.mp-sign-apl {
  display: flex;
  flex-direction: column;
}
</style>
