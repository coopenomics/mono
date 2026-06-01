<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import {
  getOrdererSignablePayload,
  finalizeIssuance,
  type MarketplaceOrderIssuanceView,
} from '../api';

/**
 * Story 6.3: финальная подпись заказчика — подтверждение получения имущества.
 *
 * Заказчик подтверждает получение сам в своём кабинете на своём устройстве
 * своим ключом. Он не редактирует факт: количество и стоимость уже
 * зафиксированы оператором при открытии выдачи и показаны в таблице только
 * для ознакомления. Заказчик может посмотреть акт и поставить финальную
 * подпись (signatureId=2) поверх подписи председателя — имущество переходит
 * к нему, backend исполняет корректирующие операции (`signiss2`).
 *
 * Диалог вызывается из карточки заказа «Моих заказов» по действию
 * «Подписать и получить» для статуса READY_TO_RECEIVE.
 */

const props = defineProps<{
  modelValue: boolean;
  order: MarketplaceOrderIssuanceView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'finalized'): void;
}>();

const globalStore = useGlobalStore();
const signing = ref(false);
const previewHtml = ref<string>('');
const previewLoading = ref(false);

const unitShort = computed(() =>
  props.order ? marketplaceUnitShort(props.order.unit_of_measure) : 'ед.',
);

// Факт зафиксирован оператором при открытии выдачи — берём из заказа.
const factQuantity = computed<number>(() => props.order?.issuance_fact?.actual_quantity ?? props.order?.quantity ?? 0);
const factCost = computed<string>(() => props.order?.issuance_fact?.fact_cost ?? props.order?.total_cost ?? '0');
const diffState = computed<string>(() => props.order?.issuance_fact?.diff_state ?? 'equal');

const diffHint = computed<string>(() => {
  if (!props.order) return '';
  if (diffState.value === 'equal') return 'Выдаётся ровно по заказу.';
  if (diffState.value === 'less') return 'Выдаётся меньше заказа — разница вернётся на ваш паевой остаток.';
  return 'Выдаётся больше заказа — разница спишется доплатой с вашего паевого остатка.';
});

watch(
  () => [props.modelValue, props.order?.id],
  ([visible]) => {
    if (visible) previewHtml.value = '';
  },
  { immediate: false },
);

async function loadPreview(): Promise<void> {
  if (!props.order) return;
  previewLoading.value = true;
  try {
    const aggregate = await getOrdererSignablePayload({ order_id: props.order.id });
    previewHtml.value = aggregate.rawDocument.html;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акт выдачи');
  } finally {
    previewLoading.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.order) return;
  const wif = globalStore.wif?.toString();
  if (!wif) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }
  signing.value = true;
  try {
    // Backend отдаёт акт, уже подписанный председателем при открытии выдачи
    // (signatureId=1). Заказчик накладывает финальную подпись (signatureId=2)
    // поверх — документ не перегенерируется.
    const aggregate = await getOrdererSignablePayload({ order_id: props.order.id });
    const signer = new Classes.Document(wif);
    const fullSigned = await signer.signDocument(
      aggregate.rawDocument,
      globalStore.username,
      2,
      [aggregate.document],
    );
    await finalizeIssuance({ order_id: props.order.id, signed_document: fullSigned });
    SuccessAlert('Имущество получено. Заказ закрыт.');
    emit('finalized');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось подтвердить получение');
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
  title="Подтверждение получения"
  maximized
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .mp-orderer-finalize(v-if="order")
    .text-caption.text-grey
      | Пункт выдачи: {{ [order.delivery_point_name, order.delivery_point_address].filter(Boolean).join(' · ') || order.delivery_braname }}

    .mp-orderer-finalize__title.text-subtitle1
      | {{ order.product_name || 'Товар по предложению' }}

    table.mp-orderer-finalize__table
      thead
        tr
          th
          th.text-right Заказ
          th.text-right К получению
      tbody
        tr
          td Количество
          td.text-right {{ order.quantity }} {{ unitShort }}
          td.text-right {{ factQuantity }} {{ unitShort }}
        tr
          td Сумма
          td.text-right {{ formatAsset2Digits(order.total_cost) }} ₽
          td.text-right {{ formatAsset2Digits(factCost) }} ₽

    q-banner.mp-orderer-finalize__hint(rounded :class="diffState === 'more' ? 'bg-warning text-dark' : (diffState === 'less' ? 'bg-info text-white' : 'bg-positive text-white')")
      | {{ diffHint }}

    .mp-orderer-finalize__preview-actions
      q-btn(flat no-caps icon="description" label="Показать акт" :loading="previewLoading" @click="loadPreview")

    q-card(v-if="previewHtml" flat bordered).mp-orderer-finalize__preview
      q-card-section.q-pa-md
        div(v-html="previewHtml")

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="primary", :loading="signing", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="16px")
      | Подписать и получить
</template>

<style scoped lang="scss">
.mp-orderer-finalize {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;

    th,
    td {
      padding: var(--p-2, 8px);
      border-bottom: 1px solid var(--p-line);
    }

    th {
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink-3);
      font-weight: 600;
    }
  }

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
