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
  cancelOrder,
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

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    // Принимаемые позиции — пайщик подписывает АПП выдачи (signiss2).
    orders: MarketplaceOrderIssuanceView[];
    // Позиции, от которых пайщик отказывается на выдаче: оператор не открыл по
    // ним выдачу (остались в acceptcoop). Подтверждая, пайщик одновременно
    // отменяет их получение — контракт удержит 50% (поставка уже акцептована).
    refusedOrders?: MarketplaceOrderIssuanceView[];
  }>(),
  { refusedOrders: () => [] },
);

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
  const o = props.orders[0] ?? props.refusedOrders[0];
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

// Отказные позиции и удержание по ним: 50% стоимости + 50% членского взноса
// (так считает контракт). Показываем пайщику, с чем он соглашается.
const refused = computed(() => props.refusedOrders);

function retainedOf(o: MarketplaceOrderIssuanceView): number {
  const base = Number.parseFloat(o.total_cost) || 0;
  const withFee = base * (1 + feePercent.value / 100);
  return withFee * 0.5;
}

const retainedTotal = computed(() =>
  refused.value.reduce((sum, o) => sum + retainedOf(o), 0),
);

const confirmLabel = computed<string>(() => {
  const a = props.orders.length;
  const r = refused.value.length;
  if (a && r) return 'Подтвердить';
  if (r) return 'Подтвердить отказ';
  return `Подписать и получить${a > 1 ? ` (${a})` : ''}`;
});

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
  const hasAccept = props.orders.length > 0;
  const hasRefuse = refused.value.length > 0;
  if (!hasAccept && !hasRefuse) return;

  // Подпись нужна только для принимаемых позиций (signiss2). Отказ — это отмена
  // получения (cancelOrder), подпись пайщика не требуется (на цепи подписывает
  // кооператив). Подтверждая, пайщик соглашается с предложенным разделением
  // целиком; «Отмена» в футере = не согласен → оператор переформировывает.
  const wif = hasAccept ? globalStore.wif?.toString() : undefined;
  if (hasAccept && !wif) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }

  signing.value = true;

  let acceptOk = 0;
  let acceptFailedNames: string[] = [];
  if (hasAccept) {
    // Крипто-флоу финальной подписи — в api (единый источник с гейтом подписи).
    const { ok, failed } = await finalizeOrdererIssuance(props.orders, wif!, globalStore.username);
    acceptOk = ok;
    acceptFailedNames = failed.map((f) => f.order.product_name || f.order.id.slice(0, 8));
  }

  let refuseOk = 0;
  const refuseFailedNames: string[] = [];
  for (const o of refused.value) {
    try {
      await cancelOrder(o.id);
      refuseOk += 1;
    } catch {
      refuseFailedNames.push(o.product_name || o.id.slice(0, 8));
    }
  }

  signing.value = false;

  if (acceptOk > 0 || refuseOk > 0) emit('finalized');

  const failedNames = [...acceptFailedNames, ...refuseFailedNames];
  if (failedNames.length === 0) {
    const parts: string[] = [];
    if (acceptOk > 0) parts.push(`получено ${acceptOk}`);
    if (refuseOk > 0) parts.push(`отказ по ${refuseOk} (удержано 50%)`);
    SuccessAlert(`Готово: ${parts.join(', ')}. Заказы закрыты.`);
    emit('update:modelValue', false);
  } else {
    FailAlert(
      new Error(`Не удалось обработать: ${failedNames.join(', ')}. Повторите по оставшимся.`),
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
  .mp-orderer-finalize(v-if="orders.length || refused.length")
    .mp-orderer-finalize__point
      q-icon(name="place" size="16px")
      | {{ pointLabel }}

    .mp-orderer-finalize__intro
      | Оператор сформировал состав получения. Сверьте: отмеченное вы получаете и
      | подписываете, от остального отказываетесь. Подтвердите целиком одной
      | кнопкой — или закройте, если не согласны, чтобы оператор переформировал.

    template(v-if="!showActs")
      template(v-if="orders.length")
        .mp-orderer-finalize__section-head Получаете
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

      template(v-if="refused.length")
        .mp-orderer-finalize__section-head.mp-orderer-finalize__section-head--neg Отказываетесь от получения
        .mp-orderer-finalize__refuse-note
          q-icon(name="info", size="16px")
          | По этим позициям удерживается 50% стоимости и членского взноса — поставка уже была принята поставщиком. Имущество остаётся на складе участка.
        .table-wrap
          .table-scroll
            table.table
              thead
                tr
                  th Позиция
                  th.col-num Заказ
                  th.col-num Удержим (50%)
              tbody
                tr(v-for="o in refused", :key="o.id")
                  td.mp-orderer-finalize__name {{ o.product_name || 'Товар по предложению' }}
                  td.col-num {{ o.quantity }} {{ unitShort(o) }}
                  td.col-num.text-negative {{ formatAsset2Digits(retainedOf(o).toFixed(4)) }} ₽

        .mp-orderer-finalize__totals
          .mp-orderer-finalize__sum
            span.mp-orderer-finalize__sum-label Будет удержано
            span.mp-orderer-finalize__sum-value.text-negative {{ formatAsset2Digits(retainedTotal.toFixed(4)) }} ₽

    .mp-orderer-finalize__preview(v-if="showActs", v-html="previewHtml")

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(v-if="orders.length", variant="ghost", :loading="previewLoading", :disabled="!orders.length", @click="toggleActs")
      template(#icon-left)
        q-icon(name="description", size="16px")
      | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
    BaseButton(variant="primary", :loading="signing", :disabled="signing || (!orders.length && !refused.length)", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="16px")
      | {{ confirmLabel }}
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

  &__section-head {
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);
    margin-top: var(--p-2, 8px);

    &--neg {
      color: var(--p-neg);
    }
  }

  &__refuse-note {
    display: flex;
    align-items: flex-start;
    gap: var(--p-1, 4px);
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
