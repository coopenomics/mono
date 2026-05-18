<script setup lang="ts">
import { ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import {
  getChairmanSignablePayload,
  openIssuance,
  type MarketplaceOrderIssuanceView,
} from '../api';

/**
 * Story 6.1 / FR21: full-screen takeover для первой подписи АПП-выдачи —
 * председатель кооперативного участка открывает выдачу заказа пайщику.
 *
 * Поток:
 *  1. Бэкенд возвращает preview документа (registry_id=1102) — HTML
 *     отображается в окне; председатель убеждается, что данные акта
 *     совпадают с заказом.
 *  2. Председатель нажимает «Подписать и открыть выдачу» — UI забирает
 *     приватный ключ из useGlobalStore и подписывает hash акта на месте
 *     (signatureId=1, signer = текущий пайщик).
 *  3. Подписанный документ уходит mutation `marketplaceOpenIssuance` —
 *     backend верифицирует подпись и отправляет on-chain `signiss1`.
 *     Заказ получает статус READY_TO_RECEIVE, заказчик — push.
 */

const props = defineProps<{
  modelValue: boolean;
  order: MarketplaceOrderIssuanceView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'opened'): void;
}>();

const globalStore = useGlobalStore();

const previewHtml = ref<string>('');
const previewLoading = ref(false);
const signing = ref(false);

watch(
  () => [props.modelValue, props.order?.id],
  async ([visible]) => {
    if (!visible || !props.order) {
      previewHtml.value = '';
      return;
    }
    previewLoading.value = true;
    try {
      const doc = await getChairmanSignablePayload(props.order.id);
      previewHtml.value = doc.html;
    } catch (e) {
      FailAlert(e, 'Не удалось загрузить предварительный акт выдачи');
      emit('update:modelValue', false);
    } finally {
      previewLoading.value = false;
    }
  },
  { immediate: false },
);

async function confirm(): Promise<void> {
  if (!props.order) return;
  const wifKey = globalStore.wif?.toString();
  if (!wifKey) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }
  signing.value = true;
  try {
    const generated = await getChairmanSignablePayload(props.order.id);
    const docSigner = new Classes.Document(wifKey);
    const signed = await docSigner.signDocument(generated, globalStore.username, 1);
    await openIssuance(props.order.id, signed);
    SuccessAlert('Выдача открыта. Заказчику отправлено уведомление.');
    emit('opened');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось открыть выдачу');
  } finally {
    signing.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  title="Открытие выдачи заказа"
  :lead-text="order ? `Заказ ${order.id.slice(0, 8)} · ${order.quantity} ед. на сумму ${order.total_cost} ₽` : ''"
  kind="info"
  confirm-label="Подписать и открыть выдачу"
  cancel-label="Закрыть"
  :loading="signing"
  :disable-confirm="!previewHtml || signing"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default)
    .mp-issue-open-dialog
      q-banner.q-mb-md(rounded class="bg-primary text-white")
        | Подпишите акт выдачи приватным ключом председателя. После подписи бэкенд отправит первую подпись на цепь и сообщит заказчику о готовности заказа.

      q-card(v-if="previewLoading" flat bordered).q-pa-md
        q-spinner(color="primary" size="32px")
        .q-ml-md Готовлю предварительный акт…

      q-card(v-else-if="previewHtml" flat bordered).mp-issue-open-dialog__preview
        q-card-section.q-pa-md
          .text-caption.text-grey Превью акта выдачи (registry_id=1102)
        q-separator
        q-card-section.q-pa-md
          div(v-html="previewHtml")

      q-card(v-else flat bordered).q-pa-md
        .text-negative Предварительный документ не сформирован.
</template>

<style scoped lang="scss">
.mp-issue-open-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__preview {
    max-height: 60vh;
    overflow: auto;
  }
}
</style>
