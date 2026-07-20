<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseDialog } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import {
  useActsPreview,
  getMembershipFeePercent,
  computeIssuanceDiff,
} from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import {
  getOrdererSignablePayload,
  finalizeOrdererIssuance,
  type MarketplaceOrderIssuanceView,
} from '../api';

/**
 * Story 6.3: финальная подпись заказчика — подтверждение получения имущества,
 * СВЕДЁННОЕ ПО ВСЕМ ПОЗИЦИЯМ ПУНКТА ВЫДАЧИ. Пайщик видит все готовые к выдаче
 * позиции в одной сводной таблице и подтверждает получение ОДНОЙ операцией —
 * не жмёт по каждой позиции отдельно.
 *
 * Факт он не редактирует: количество и стоимость зафиксированы оператором при
 * открытии выдачи и показаны только для ознакомления. По кнопке UI ЦИКЛОМ по
 * всем позициям накладывает финальную подпись (signatureId=2) поверх подписи
 * председателя — документ не перегенерируется, backend исполняет
 * корректирующие операции (`signiss2`). Каждая позиция = свой акт.
 */

const props = defineProps<{
  modelValue: boolean;
  orders: MarketplaceOrderIssuanceView[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'finalized'): void;
}>();

const globalStore = useGlobalStore();
const signing = ref(false);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
// Единый паттерн «Показать / Скрыть акты»: таблица состава прячется при показе.
const { showActs, toggleActs, resetActs } = useActsPreview(loadPreview, previewHtml);

const pointLabel = computed<string>(() => {
  const o = props.orders[0];
  if (!o) return '';
  return (
    [o.delivery_point_name, o.delivery_point_address].filter(Boolean).join(' · ') ||
    o.delivery_braname
  );
});

function unitShort(o: MarketplaceOrderIssuanceView): string {
  return marketplaceUnitShort(o.unit_of_measure);
}
function factQty(o: MarketplaceOrderIssuanceView): number {
  return o.issuance_fact?.actual_quantity ?? o.quantity ?? 0;
}
function factCost(o: MarketplaceOrderIssuanceView): string {
  return o.issuance_fact?.fact_cost ?? o.total_cost ?? '0';
}

// Совокупная сумма к получению по всем позициям.
const totalFactCost = computed<string>(() =>
  props.orders.reduce((sum, o) => sum + Number.parseFloat(factCost(o)), 0).toFixed(4),
);

// Ставка членского взноса — для оценки возврата при выдаче меньше заказа.
const feePercent = ref(0);

// Пайщику сразу видно, сколько вернётся в кошелёк Стола заказов, если выдано
// меньше заказанного (остаток резерва + часть взноса), и сколько спишется с
// паевого при факте больше заказа.
const issuanceDiff = computed(() =>
  computeIssuanceDiff(
    props.orders.map((o) => ({
      orderedTotal: Number.parseFloat(o.total_cost),
      factTotal: Number.parseFloat(factCost(o)),
    })),
    feePercent.value,
  ),
);

const DIFF_BADGE: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  equal: { label: 'по заказу', variant: 'pos' },
  less: { label: 'недостача', variant: 'warn' },
  more: { label: 'избыток', variant: 'info' },
};
function diffBadge(o: MarketplaceOrderIssuanceView): { label: string; variant: BaseBadgeVariant } {
  return DIFF_BADGE[o.issuance_fact?.diff_state ?? 'equal'] ?? DIFF_BADGE.equal;
}

watch(
  () => [props.modelValue, props.orders.map((o) => o.id).join(',')],
  ([visible]) => {
    if (visible) {
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

async function loadPreview(): Promise<void> {
  if (!props.orders.length) return;
  previewLoading.value = true;
  try {
    const parts: string[] = [];
    for (const o of props.orders) {
      const aggregate = await getOrdererSignablePayload({ order_id: o.id });
      const title = o.product_name || 'Товар по предложению';
      parts.push(`<h4 class="mp-orderer-finalize__act-head">${title}</h4>${aggregate.rawDocument.html}`);
    }
    previewHtml.value = parts.join('<hr class="mp-orderer-finalize__act-sep" />');
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты выдачи');
  } finally {
    previewLoading.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.orders.length) return;
  const wif = globalStore.wif?.toString();
  if (!wif) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }
  signing.value = true;
  // Крипто-флоу финальной подписи вынесен в api (finalizeOrdererIssuance) —
  // единый источник с глобальным гейтом подписи на месте.
  const { ok, failed } = await finalizeOrdererIssuance(
    props.orders,
    wif,
    globalStore.username,
  );
  signing.value = false;

  if (ok > 0) emit('finalized');
  if (failed.length === 0) {
    SuccessAlert(`Имущество получено по ${ok} позиц. Заказы закрыты.`);
    emit('update:modelValue', false);
  } else {
    const names = failed.map((f) => f.order.product_name || f.order.id.slice(0, 8));
    FailAlert(
      new Error(
        `Получено ${ok} из ${props.orders.length}. Не удалось: ${names.join(', ')}. Повторите по оставшимся.`,
      ),
    );
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
  .mp-orderer-finalize(v-if="orders.length")
    .mp-orderer-finalize__point
      q-icon(name="place" size="16px")
      | {{ pointLabel }}

    .mp-orderer-finalize__intro
      | Сверьте полученное имущество. Количество и стоимость зафиксированы при
      | открытии выдачи — подтвердите получение по всем позициям одной подписью.

    template(v-if="!showActs")
      .table-wrap
        .table-scroll
          table.table
            thead
              tr
                th Позиция
                th.col-num Заказ
                th.col-num К получению
                th.col-num Сумма
                th.col-state Итог
            tbody
              tr(v-for="o in orders", :key="o.id")
                td.mp-orderer-finalize__name {{ o.product_name || 'Товар по предложению' }}
                td.col-num {{ o.quantity }} {{ unitShort(o) }}
                td.col-num {{ factQty(o) }} {{ unitShort(o) }}
                td.col-num {{ formatAsset2Digits(factCost(o)) }} ₽
                td.col-state
                  BaseBadge(:variant="diffBadge(o).variant") {{ diffBadge(o).label }}

      .mp-orderer-finalize__totals
        .mp-orderer-finalize__sum
          span.mp-orderer-finalize__sum-label Итого к получению
          span.mp-orderer-finalize__sum-value {{ formatAsset2Digits(totalFactCost) }} ₽
        .mp-orderer-finalize__sum(v-if="issuanceDiff.refund > 0")
          span.mp-orderer-finalize__sum-label Вернётся в кошелёк Стола заказов
          span.mp-orderer-finalize__sum-value {{ formatAsset2Digits(issuanceDiff.refund.toFixed(4)) }} ₽
        .mp-orderer-finalize__sum(v-if="issuanceDiff.surcharge > 0")
          span.mp-orderer-finalize__sum-label Доплата по факту (спишется с паевого)
          span.mp-orderer-finalize__sum-value {{ formatAsset2Digits(issuanceDiff.surcharge.toFixed(4)) }} ₽

    .mp-orderer-finalize__preview(v-if="showActs", v-html="previewHtml")

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="ghost", :loading="previewLoading", :disabled="!orders.length", @click="toggleActs")
      template(#icon-left)
        q-icon(name="description", size="16px")
      | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
    BaseButton(variant="primary", :loading="signing", :disabled="signing || !orders.length", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="16px")
      | Подписать и получить{{ orders.length > 1 ? ` (${orders.length})` : '' }}
</template>

<style scoped lang="scss">
.mp-orderer-finalize {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__point {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__intro {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    line-height: 1.4;
  }

  &__name {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  .col-num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .col-state {
    text-align: center;
    width: 120px;
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

  &__preview {
    max-height: 60vh;
    overflow: auto;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
    background: var(--p-surface);
  }

  :deep(.mp-orderer-finalize__act-head) {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    margin: 0 0 var(--p-2, 8px);
  }

  :deep(.mp-orderer-finalize__act-sep) {
    border: none;
    border-top: 1px solid var(--p-line);
    margin: var(--p-4, 16px) 0;
  }
}
</style>
