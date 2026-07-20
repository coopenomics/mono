<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton } from 'src/shared/ui/base';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { CorrectionTable, type CorrectionRow } from 'src/widgets/Marketplace/CorrectionTable';
import { useActsPreview } from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import {
  getChairmanSignablePayload,
  openIssuance,
  type MarketplaceOrderIssuanceView,
} from '../api';

/**
 * Story 6.1 / FR21: full-screen takeover для открытия выдачи на ПВЗ —
 * СГРУППИРОВАННОЙ ПО ПАЙЩИКУ. Пайщик приходит за всем, что ему причитается;
 * оператор открывает выдачу ОДНОЙ операцией по всем позициям заказчика.
 *
 * Открытие выдачи делает оператор КУ. Здесь фиксируется факт: оператор сверяет
 * привезённое имущество с каждым заказом и корректирует фактически выдаваемое
 * количество — оно зашивается в подписываемый председателем акт ПО КАЖДОЙ
 * позиции и сохраняется на заказе. Финальная подпись заказчика факт не
 * редактирует.
 *
 * Поток:
 *  1. Оператор корректирует количество/цену в сводной таблице сверки (строка на
 *     позицию, предзаполнена заказом).
 *  2. «Открыть выдачу» — UI ЦИКЛОМ по всем позициям: формирует акт на
 *     фактическое количество, подписывает ключом председателя сессии
 *     (signatureId=1) и отправляет в `openIssuance`. Каждая позиция = свой акт
 *     (результаты могут различаться). Заказы переходят в «Готово к получению»,
 *     заказчику — уведомление; финальную подпись он поставит сам.
 */

const props = defineProps<{
  modelValue: boolean;
  orders: MarketplaceOrderIssuanceView[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'opened'): void;
}>();

const globalStore = useGlobalStore();

// Редактируемый факт по каждой позиции, ключ — id заказа.
interface FactState {
  qty: number;
  price: number;
}
const facts = ref<Record<string, FactState>>({});
const previewHtml = ref<string>('');
const previewLoading = ref(false);
const signing = ref(false);
// Единый паттерн «Показать / Скрыть акты»: таблица сверки прячется при показе.
const { showActs, toggleActs, resetActs } = useActsPreview(loadPreview, previewHtml);

// sku (короткий, отображается в таблице) → id заказа, для onChange-маппинга.
const skuToId = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {};
  for (const o of props.orders) m[o.id.slice(0, 8)] = o.id;
  return m;
});

/**
 * Потолок выдачи по заказу — фактически принято на склад КУ и не выдано.
 * Выдать больше физического остатка нельзя (инцидент 2026-06-09: заказ 10,
 * принято 5, акт ушёл на 10). null/undefined трактуем как «нет данных» и
 * ограничиваем заказом — backend-гард всё равно не пропустит больше склада.
 */
function availableOf(o: MarketplaceOrderIssuanceView): number {
  return o.warehouse_quantity ?? o.quantity;
}

function initFacts(): void {
  const next: Record<string, FactState> = {};
  for (const o of props.orders) {
    // Дефолт факта — что реально можно выдать: min(заказано, принято на склад).
    next[o.id] = {
      qty: Math.min(o.quantity, availableOf(o)),
      price: Number.parseFloat(o.price_per_unit),
    };
  }
  facts.value = next;
}

const correctionRows = computed<CorrectionRow[]>(() =>
  props.orders.map((o) => {
    const f = facts.value[o.id];
    return {
      sku: o.id.slice(0, 8),
      title: o.product_name || 'Товар по предложению',
      unit: marketplaceUnitShort(o.unit_of_measure),
      expected: o.quantity,
      available: availableOf(o),
      fact: f?.qty ?? Math.min(o.quantity, availableOf(o)),
      expectedPrice: Number.parseFloat(o.price_per_unit),
      factPrice: f?.price ?? Number.parseFloat(o.price_per_unit),
    };
  }),
);

// Итоговая сумма к выдаче по всем позициям.
const totalFactCost = computed<string>(() => {
  let sum = 0;
  for (const o of props.orders) {
    const f = facts.value[o.id];
    if (f) sum += f.qty * f.price;
  }
  return sum.toFixed(4);
});

const positionsCount = computed(() => props.orders.length);

const recipientName = computed(
  () => props.orders.find((o) => o.orderer_name)?.orderer_name || props.orders[0]?.orderer_account || '',
);

// Хотя бы одна позиция вышла за пределы заказа — окрашиваем takeover в warning.
const anyOver = computed(() =>
  props.orders.some((o) => (facts.value[o.id]?.qty ?? o.quantity) > o.quantity),
);

// Превышение склада: ввод выше принятого. Кнопки подписи и превью блокируются.
const anyOverStock = computed(() =>
  props.orders.some((o) => (facts.value[o.id]?.qty ?? 0) > availableOf(o)),
);

const allValid = computed(() =>
  props.orders.length > 0 &&
  !anyOverStock.value &&
  props.orders.every((o) => {
    const f = facts.value[o.id];
    return f && f.qty > 0 && f.price > 0;
  }),
);

watch(
  () => [props.modelValue, props.orders.map((o) => o.id).join(',')],
  ([visible]) => {
    if (visible && props.orders.length) {
      initFacts();
      resetActs();
    }
  },
  { immediate: false },
);

function onCorrectionChange(payload: { sku: string; fact: number; factPrice?: number }): void {
  const id = skuToId.value[payload.sku];
  if (!id) return;
  const order = props.orders.find((o) => o.id === id);
  const f = facts.value[id] ?? { qty: 0, price: 0 };
  // Корректируем форму к потолку склада сразу при вводе: выдать больше
  // принятого нельзя, акт на большее не сформируется (двойная защита с
  // backend-гардом). Таблица показывает откорректированное значение.
  const ceiling = order ? availableOf(order) : Number.POSITIVE_INFINITY;
  f.qty = Math.min(Math.max(0, payload.fact), ceiling);
  if (payload.factPrice !== undefined) f.price = Math.max(0, payload.factPrice);
  facts.value = { ...facts.value, [id]: f };
  // Акты зависят от факта — сбрасываем устаревший превью.
  previewHtml.value = '';
}

async function loadPreview(): Promise<void> {
  if (!allValid.value) {
    FailAlert(new Error('Укажите фактическое количество и цену больше нуля по всем позициям.'));
    return;
  }
  previewLoading.value = true;
  try {
    // Превью всех актов пайщика на одной странице — предварительное ознакомление.
    const parts: string[] = [];
    for (const o of props.orders) {
      const f = facts.value[o.id];
      const doc = await getChairmanSignablePayload({
        order_id: o.id,
        actual_quantity: f.qty,
        actual_unit_price: String(f.price),
      });
      const title = o.product_name || 'Товар по предложению';
      parts.push(`<h4 class="mp-issue-open-dialog__act-head">${title}</h4>${doc.html}`);
    }
    previewHtml.value = parts.join('<hr class="mp-issue-open-dialog__act-sep" />');
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать акты выдачи');
  } finally {
    previewLoading.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.orders.length) return;
  if (!allValid.value) {
    FailAlert(new Error('Фактическое количество и цена должны быть больше нуля по всем позициям.'));
    return;
  }
  const wifKey = globalStore.wif?.toString();
  if (!wifKey) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }
  signing.value = true;
  const docSigner = new Classes.Document(wifKey);
  const failed: string[] = [];
  let ok = 0;
  // По позициям ПАРАЛЛЕЛЬНО: каждая — отдельный акт (председатель →
  // openIssuance, signiss1). У заказов разные хэши — на цепи это разные
  // документы, гонок подписи нет, и все позиции пункта взводятся в
  // READY_TO_RECEIVE почти в один блок. Это устраняет «прилёт по одной»:
  // заказчик видит весь комплект сразу, а не по мере ~0.5с/акт.
  await Promise.all(
    props.orders.map(async (o) => {
      const f = facts.value[o.id];
      const priceStr = String(f.price);
      try {
        const generated = await getChairmanSignablePayload({
          order_id: o.id,
          actual_quantity: f.qty,
          actual_unit_price: priceStr,
        });
        const signed = await docSigner.signDocument(generated, globalStore.username, 1);
        await openIssuance({
          order_id: o.id,
          actual_quantity: f.qty,
          actual_unit_price: priceStr,
          signed_document: signed,
        });
        ok += 1;
      } catch (e) {
        console.error('openIssuance failed for order', o.id, e);
        failed.push(o.product_name || o.id.slice(0, 8));
      }
    }),
  );
  signing.value = false;

  if (ok > 0) emit('opened');
  if (failed.length === 0) {
    SuccessAlert(
      `Выдача открыта по ${ok} позиц. — ждём подтверждение заказчика в его кабинете.`,
    );
    emit('update:modelValue', false);
  } else {
    FailAlert(
      new Error(
        `Открыто ${ok} из ${props.orders.length}. Не удалось: ${failed.join(', ')}. Повторите по оставшимся.`,
      ),
    );
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  wide
  title="Открытие выдачи пайщику"
  :lead-text="recipientName ? `${recipientName} · позиций: ${positionsCount} · к выдаче ${formatAsset2Digits(totalFactCost)} ₽` : ''"
  :kind="anyOver ? 'warning' : 'info'"
  :loading="signing"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default)
    .mp-issue-open-dialog
      .mp-issue-open-dialog__intro
        | Сверьте имущество на складе с заказами пайщика: «План» — сколько
        | заказано, «Принято» — сколько фактически принято на склад и доступно
        | к выдаче. Выдать больше принятого нельзя — факт ограничен складом.
        | Открытие выдачи сформирует и подпишет акты сразу по всем позициям.

      template(v-if="!showActs")
        CorrectionTable(:rows="correctionRows" @change="onCorrectionChange")

        .mp-issue-open-dialog__sum
          span.mp-issue-open-dialog__sum-label К выдаче по всем позициям
          span.mp-issue-open-dialog__sum-value {{ formatAsset2Digits(totalFactCost) }} ₽

      .mp-issue-open-dialog__preview(v-if="showActs", v-html="previewHtml")

  template(#actions="{ cancel: onCancel, confirm: onConfirm }")
    BaseButton(variant="ghost" @click="onCancel") Закрыть
    BaseButton(
      variant="ghost"
      :loading="previewLoading"
      :disabled="!allValid"
      @click="toggleActs"
    )
      template(#icon-left)
        q-icon(name="description" size="16px")
      | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
    BaseButton(
      variant="primary"
      :loading="signing"
      :disabled="!allValid || signing"
      @click="onConfirm"
    )
      template(#icon-left)
        q-icon(name="draw" size="16px")
      | Подписать и открыть выдачу
</template>

<style scoped lang="scss">
.mp-issue-open-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__intro {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    line-height: 1.4;
  }

  &__sum {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: var(--p-3, 12px);
  }

  &__sum-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__sum-value {
    font-family: var(--p-mono);
    font-weight: 600;
    font-size: var(--p-fs-h3, 15px);
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__preview {
    max-height: 60vh;
    overflow: auto;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
    background: var(--p-surface);
  }

  // Заголовок акта и разделитель в сводном превью.
  :deep(.mp-issue-open-dialog__act-head) {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    margin: 0 0 var(--p-2, 8px);
  }

  :deep(.mp-issue-open-dialog__act-sep) {
    border: none;
    border-top: 1px solid var(--p-line);
    margin: var(--p-4, 16px) 0;
  }
}
</style>
