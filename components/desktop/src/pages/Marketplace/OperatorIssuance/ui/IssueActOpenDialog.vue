<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton } from 'src/shared/ui/base';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { CorrectionTable, type CorrectionRow } from 'src/widgets/Marketplace/CorrectionTable';
import {
  useActsPreview,
  getMembershipFeePercent,
  computeIssuanceDiff,
} from 'src/shared/lib/marketplace';
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
  // Частичная выдача: выдаём ли позицию в этой операции. Снятая галочка =
  // имущество остаётся на складе, акт по позиции не формируется.
  included: boolean;
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
    // По умолчанию выдаём то, что есть на складе; позиции с нулём на складе
    // выключены из выдачи (выдавать нечего) — оператор включит вручную нельзя.
    next[o.id] = {
      qty: Math.min(o.quantity, availableOf(o)),
      price: Number.parseFloat(o.price_per_unit),
      included: availableOf(o) > 0,
    };
  }
  facts.value = next;
}

// Позиции, которые реально уйдут в выдачу (галочка стоит и есть что выдать).
const includedOrders = computed(() =>
  props.orders.filter((o) => facts.value[o.id]?.included && availableOf(o) > 0),
);

const correctionRows = computed<CorrectionRow[]>(() =>
  props.orders.map((o) => {
    const f = facts.value[o.id];
    return {
      sku: o.id.slice(0, 8),
      title: o.product_name || 'Товар по предложению',
      unit: marketplaceUnitShort(o.unit_of_measure),
      expected: o.quantity,
      available: availableOf(o),
      shelf: (o.warehouse_shelves ?? []).join(', ') || undefined,
      fact: f?.qty ?? Math.min(o.quantity, availableOf(o)),
      expectedPrice: Number.parseFloat(o.price_per_unit),
      factPrice: f?.price ?? Number.parseFloat(o.price_per_unit),
      included: f?.included ?? availableOf(o) > 0,
    };
  }),
);

// Итоговая сумма к выдаче — только по выбранным к выдаче позициям.
const totalFactCost = computed<string>(() => {
  let sum = 0;
  for (const o of includedOrders.value) {
    const f = facts.value[o.id];
    if (f) sum += f.qty * f.price;
  }
  return sum.toFixed(4);
});

// Ставка членского взноса — для оценки возврата/доплаты при расхождении факта.
const feePercent = ref(0);

// Недосдача видна сразу: сколько вернётся пайщику в кошелёк Стола заказов
// (остаток резерва + пропорциональная часть взноса), при факте больше заказа —
// сколько спишется с паевого.
const issuanceDiff = computed(() =>
  computeIssuanceDiff(
    includedOrders.value.map((o) => {
      const f = facts.value[o.id];
      return {
        orderedTotal: Number.parseFloat(o.total_cost),
        factTotal: f ? f.qty * f.price : Number.parseFloat(o.total_cost),
      };
    }),
    feePercent.value,
  ),
);

const positionsCount = computed(() => props.orders.length);
const includedCount = computed(() => includedOrders.value.length);
// Сколько позиций остаётся на складе (не выдаём в этой операции).
const leftCount = computed(() => positionsCount.value - includedCount.value);

const recipientName = computed(
  () => props.orders.find((o) => o.orderer_name)?.orderer_name || props.orders[0]?.orderer_account || '',
);

// Хотя бы одна ВЫДАВАЕМАЯ позиция вышла за пределы заказа — окрашиваем в warning.
const anyOver = computed(() =>
  includedOrders.value.some((o) => (facts.value[o.id]?.qty ?? o.quantity) > o.quantity),
);

// Превышение склада среди выдаваемых: ввод выше принятого. Блокирует подпись.
const anyOverStock = computed(() =>
  includedOrders.value.some((o) => (facts.value[o.id]?.qty ?? 0) > availableOf(o)),
);

// Валидно, если есть хотя бы одна выбранная к выдаче позиция и все выбранные
// корректны. Невыбранные (остаются на складе) на валидность не влияют.
const allValid = computed(() =>
  includedOrders.value.length > 0 &&
  !anyOverStock.value &&
  includedOrders.value.every((o) => {
    const f = facts.value[o.id];
    return f && f.qty > 0 && f.price > 0;
  }),
);

// Человекочитаемая причина, почему «Подписать и открыть выдачу» недоступна —
// чтобы оператор не гадал над перечёркнутой кнопкой.
const blockReason = computed<string | null>(() => {
  if (!props.orders.length) return null;
  const names = (list: MarketplaceOrderIssuanceView[]) =>
    list.map((o) => o.product_name || o.id.slice(0, 8)).join(', ');

  if (includedOrders.value.length === 0) {
    return 'Отметьте хотя бы одну позицию к выдаче. Невыбранные позиции останутся на складе.';
  }
  if (anyOverStock.value) {
    const over = includedOrders.value.filter((o) => (facts.value[o.id]?.qty ?? 0) > availableOf(o));
    return `Факт больше принятого на склад по позиц.: ${names(over)}. Уменьшите количество до значения «Принято».`;
  }
  const zeroQty = includedOrders.value.filter((o) => (facts.value[o.id]?.qty ?? 0) <= 0);
  if (zeroQty.length) {
    return `Укажите фактическое количество больше нуля по позиц.: ${names(zeroQty)}.`;
  }
  const zeroPrice = includedOrders.value.filter((o) => (facts.value[o.id]?.price ?? 0) <= 0);
  if (zeroPrice.length) {
    return `Укажите цену больше нуля по позиц.: ${names(zeroPrice)}.`;
  }
  return null;
});

watch(
  () => [props.modelValue, props.orders.map((o) => o.id).join(',')],
  ([visible]) => {
    if (visible && props.orders.length) {
      initFacts();
      resetActs();
      if (!feePercent.value) {
        getMembershipFeePercent()
          .then((p) => (feePercent.value = p))
          .catch(() => undefined); // нет ставки — возврат покажем без взноса
      }
    }
  },
  { immediate: false },
);

function onCorrectionChange(payload: { sku: string; fact: number; factPrice?: number }): void {
  const id = skuToId.value[payload.sku];
  if (!id) return;
  const order = props.orders.find((o) => o.id === id);
  const f = facts.value[id] ?? { qty: 0, price: 0, included: true };
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

function onCorrectionToggle(payload: { sku: string; included: boolean }): void {
  const id = skuToId.value[payload.sku];
  if (!id) return;
  const order = props.orders.find((o) => o.id === id);
  // Позицию без склада включить нельзя — выдавать нечего.
  if (payload.included && order && availableOf(order) <= 0) return;
  const f = facts.value[id] ?? { qty: 0, price: 0, included: false };
  f.included = payload.included;
  facts.value = { ...facts.value, [id]: f };
  previewHtml.value = '';
}

async function loadPreview(): Promise<void> {
  if (!allValid.value) {
    FailAlert(new Error('Укажите фактическое количество и цену больше нуля по всем позициям.'));
    return;
  }
  previewLoading.value = true;
  try {
    // Превью актов только по выдаваемым позициям — предварительное ознакомление.
    const parts: string[] = [];
    for (const o of includedOrders.value) {
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
  // По выдаваемым позициям ПАРАЛЛЕЛЬНО: каждая — отдельный акт (председатель →
  // openIssuance, signiss1). Невыбранные позиции в выдачу не идут — остаются на
  // складе в текущем статусе (частичная выдача). У заказов разные хэши — на цепи
  // это разные документы, гонок подписи нет, и все позиции взводятся в
  // READY_TO_RECEIVE почти в один блок.
  await Promise.all(
    includedOrders.value.map(async (o) => {
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
    const tail = leftCount.value > 0
      ? ` Осталось на складе позиц.: ${leftCount.value}.`
      : '';
    SuccessAlert(
      `Выдача открыта по ${ok} позиц. — ждём подтверждение заказчика.${tail}`,
    );
    emit('update:modelValue', false);
  } else {
    FailAlert(
      new Error(
        `Открыто ${ok} из ${includedCount.value}. Не удалось: ${failed.join(', ')}. Повторите по оставшимся.`,
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
  :lead-text="recipientName ? `${recipientName} · к выдаче ${includedCount} из ${positionsCount} · ${formatAsset2Digits(totalFactCost)} ₽${issuanceDiff.refund > 0 ? ` · вернётся в кошелёк ${formatAsset2Digits(issuanceDiff.refund.toFixed(4))} ₽` : ''}` : ''"
  :kind="anyOver ? 'warning' : 'info'"
  :loading="signing"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default)
    .mp-issue-open-dialog
      .mp-issue-open-dialog__intro
        | Сверьте имущество с заказами пайщика и отметьте галочкой «Выдать» то,
        | что он забирает сейчас. «План» — сколько заказано, «Принято» — сколько
        | на складе и доступно к выдаче (выдать больше нельзя). Снятые позиции
        | остаются на складе и в эту выдачу не попадают — выдаём частично.

      template(v-if="!showActs")
        CorrectionTable(:rows="correctionRows" selectable @change="onCorrectionChange" @toggle="onCorrectionToggle")

        .mp-issue-open-dialog__totals
          .mp-issue-open-dialog__sum
            span.mp-issue-open-dialog__sum-label К выдаче ({{ includedCount }} из {{ positionsCount }} позиц.)
            span.mp-issue-open-dialog__sum-value {{ formatAsset2Digits(totalFactCost) }} ₽
          .mp-issue-open-dialog__sum(v-if="leftCount > 0")
            span.mp-issue-open-dialog__sum-label Остаётся на складе
            span.mp-issue-open-dialog__sum-value {{ leftCount }} позиц.
          .mp-issue-open-dialog__sum(v-if="issuanceDiff.refund > 0")
            span.mp-issue-open-dialog__sum-label Вернётся в кошелёк Стола заказов
            span.mp-issue-open-dialog__sum-value {{ formatAsset2Digits(issuanceDiff.refund.toFixed(4)) }} ₽
          .mp-issue-open-dialog__sum(v-if="issuanceDiff.surcharge > 0")
            span.mp-issue-open-dialog__sum-label Доплата по факту (спишется с паевого)
            span.mp-issue-open-dialog__sum-value {{ formatAsset2Digits(issuanceDiff.surcharge.toFixed(4)) }} ₽

        //- Почему кнопка «Подписать и открыть выдачу» недоступна — явно, чтобы
        //- оператор не упирался в перечёркнутую кнопку без объяснения.
        .mp-issue-open-dialog__blocker(v-if="blockReason")
          q-icon(name="info" size="18px")
          span {{ blockReason }}

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

  &__totals {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
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

  &__blocker {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    margin-top: var(--p-3, 12px);
    padding: var(--p-3, 12px);
    border: 1px solid var(--p-warn-line, var(--p-line));
    border-radius: var(--p-r-md, 12px);
    background: var(--p-warn-soft);
    color: var(--p-warn);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: 1.4;

    .q-icon {
      flex-shrink: 0;
      margin-top: 1px;
    }
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
