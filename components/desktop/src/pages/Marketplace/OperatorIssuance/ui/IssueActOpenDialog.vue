<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { CorrectionTable, type CorrectionRow } from 'src/widgets/Marketplace/CorrectionTable';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import {
  getChairmanSignablePayload,
  openIssuance,
  type MarketplaceOrderIssuanceView,
} from '../api';

/**
 * Story 6.1 / FR21: full-screen takeover для открытия выдачи на ПВЗ.
 *
 * Открытие выдачи делает оператор КУ. Именно здесь фиксируется факт: оператор
 * сверяет привезённое имущество с заказом, взвешивает/пересчитывает и
 * корректирует фактически выдаваемое количество. Это количество зашивается в
 * подписываемый председателем акт и сохраняется на заказе — финальная подпись
 * заказчика факт уже не редактирует.
 *
 * Поток:
 *  1. Оператор корректирует количество в таблице сверки (предзаполнено заказом).
 *  2. По кнопке «Показать акт» можно посмотреть сформированный документ.
 *  3. «Открыть выдачу» — UI берёт акт на фактическое количество, подписывает
 *     его ключом председателя текущей сессии (signatureId=1) и отправляет в
 *     `openIssuance`. Заказ переходит в «Готово к получению», заказчику —
 *     уведомление; финальную подпись он поставит сам в своём кабинете.
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

const actualQuantity = ref<number>(0);
const actualUnitPrice = ref<number>(0);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
const signing = ref(false);

const unitShort = computed(() =>
  props.order ? marketplaceUnitShort(props.order.unit_of_measure) : 'ед.',
);

const factCost = computed<string>(() => {
  if (!props.order) return '0';
  return (actualQuantity.value * actualUnitPrice.value).toFixed(4);
});

const diffState = computed<'equal' | 'less' | 'more'>(() => {
  if (!props.order) return 'equal';
  if (actualQuantity.value === props.order.quantity) return 'equal';
  if (actualQuantity.value < props.order.quantity) return 'less';
  return 'more';
});

const diffHint = computed<string>(() => {
  if (!props.order) return '';
  if (diffState.value === 'equal') return 'Факт совпадает с заказом.';
  if (diffState.value === 'less')
    return `Выдаётся меньше заказа на ${props.order.quantity - actualQuantity.value} ${unitShort.value} — разница вернётся заказчику.`;
  return `Выдаётся больше заказа на ${actualQuantity.value - props.order.quantity} ${unitShort.value} — потребуется доплата с паевого заказчика.`;
});

const correctionRows = computed<CorrectionRow[]>(() => {
  if (!props.order) return [];
  const orderedPrice = Number.parseFloat(props.order.price_per_unit);
  return [
    {
      sku: props.order.id.slice(0, 8),
      title: props.order.product_name || 'Товар по предложению',
      unit: unitShort.value,
      expected: props.order.quantity,
      fact: actualQuantity.value,
      expectedPrice: orderedPrice,
      factPrice: actualUnitPrice.value,
    },
  ];
});

watch(
  () => [props.modelValue, props.order?.id],
  ([visible]) => {
    if (visible && props.order) {
      actualQuantity.value = props.order.quantity;
      actualUnitPrice.value = Number.parseFloat(props.order.price_per_unit);
      previewHtml.value = '';
    }
  },
  { immediate: false },
);

function onCorrectionChange(payload: { sku: string; fact: number; factPrice?: number }): void {
  actualQuantity.value = Math.max(0, payload.fact);
  if (payload.factPrice !== undefined) {
    actualUnitPrice.value = Math.max(0, payload.factPrice);
  }
  // Документ зависит от факта — сбрасываем устаревший превью.
  previewHtml.value = '';
}

async function loadPreview(): Promise<void> {
  if (!props.order || actualQuantity.value <= 0 || actualUnitPrice.value <= 0) {
    FailAlert(new Error('Сначала укажите фактическое количество и цену больше нуля.'));
    return;
  }
  previewLoading.value = true;
  try {
    const doc = await getChairmanSignablePayload({
      order_id: props.order.id,
      actual_quantity: actualQuantity.value,
      actual_unit_price: String(actualUnitPrice.value),
    });
    previewHtml.value = doc.html;
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать акт выдачи');
  } finally {
    previewLoading.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.order) return;
  if (actualQuantity.value <= 0) {
    FailAlert(new Error('Фактическое количество должно быть больше нуля.'));
    return;
  }
  if (actualUnitPrice.value <= 0) {
    FailAlert(new Error('Фактическая цена за единицу должна быть больше нуля.'));
    return;
  }
  const wifKey = globalStore.wif?.toString();
  if (!wifKey) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }
  signing.value = true;
  try {
    const unitPriceStr = String(actualUnitPrice.value);
    const generated = await getChairmanSignablePayload({
      order_id: props.order.id,
      actual_quantity: actualQuantity.value,
      actual_unit_price: unitPriceStr,
    });
    const docSigner = new Classes.Document(wifKey);
    const signed = await docSigner.signDocument(generated, globalStore.username, 1);
    await openIssuance({
      order_id: props.order.id,
      actual_quantity: actualQuantity.value,
      actual_unit_price: unitPriceStr,
      signed_document: signed,
    });
    SuccessAlert('Выдача открыта. Ждём подпись заказчика — он подтвердит получение в своём кабинете.');
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
  :lead-text="order ? `Заказ ${order.id.slice(0, 8)} · к выдаче ${formatAsset2Digits(factCost)} ₽` : ''"
  :kind="diffState === 'more' ? 'warning' : 'info'"
  confirm-label="Подписать и открыть выдачу"
  cancel-label="Закрыть"
  :loading="signing"
  :disable-confirm="actualQuantity <= 0 || actualUnitPrice <= 0 || signing"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default)
    .mp-issue-open-dialog
      .mp-issue-open-dialog__intro.text-body2.text-grey
        | Сверьте привезённое имущество с заказом и укажите фактически выдаваемое количество — оно войдёт в акт.

      CorrectionTable(:rows="correctionRows" @change="onCorrectionChange")

      q-banner.mp-issue-open-dialog__hint(rounded :class="diffState === 'more' ? 'bg-warning text-dark' : (diffState === 'less' ? 'bg-info text-white' : 'bg-positive text-white')")
        | {{ diffHint }}

      .mp-issue-open-dialog__sum.text-body2
        | К выдаче: {{ formatAsset2Digits(factCost) }} ₽ ({{ actualQuantity }} {{ unitShort }})

      .mp-issue-open-dialog__preview-actions
        q-btn(flat no-caps icon="description" label="Показать акт" :loading="previewLoading" @click="loadPreview")

      q-card(v-if="previewHtml" flat bordered).mp-issue-open-dialog__preview
        q-card-section.q-pa-md
          div(v-html="previewHtml")
</template>

<style scoped lang="scss">
.mp-issue-open-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__sum {
    font-variant-numeric: tabular-nums;
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
