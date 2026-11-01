<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseBadge, BaseDialog } from 'src/shared/ui/base';
import { ActDialogLayout, ActSummaryCard } from 'src/widgets/Marketplace/ActDialogLayout';
import { CorrectionTable, type CorrectionRow } from 'src/widgets/Marketplace/CorrectionTable';
import {
  getMembershipFeePercent,
  applyMembershipFee,
  computeIssuanceDiff,
  marketplaceLineCost,
} from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import {
  getStockIssuancePayloads,
  createStockProposal,
  type CreateStockProposalInput,
  type MarketplaceOrderIssuanceView,
} from '../api';
import { t } from 'src/shared/i18n';

// Строки бандла — тип берём прямо из SDK-входа.
type StockBundleStockLine = NonNullable<CreateStockProposalInput['items']>[number];
type StockBundleOrderLine = NonNullable<CreateStockProposalInput['order_items']>[number];
import StockPickDialog, { type StockPickLine } from './StockPickDialog.vue';

/**
 * Full-screen takeover выдачи на ПВЗ — СГРУППИРОВАННОЙ ПО ПАЙЩИКУ (паевая
 * модель, компонент 68). Пайщик приходит за всем, что ему причитается;
 * оператор фиксирует факт ОДНОЙ операцией по всем позициям заказчика.
 *
 * Здесь фиксируется факт: оператор сверяет привезённое имущество с каждым
 * заказом и корректирует фактически выдаваемое количество/цену. Подписей у
 * оператора на этом шаге НЕТ — его подпись закрывающая, после акта пайщика.
 *
 * Поток:
 *  1. Оператор корректирует количество/цену в сводной таблице сверки и при
 *     желании добавляет докладку со склада.
 *  2. «Отправить пайщику» — единым `createStockProposal` уходит бандл; по
 *     существующим заказам сразу рождаются саги выдачи (факт зафиксирован).
 *     Пайщику немедленно всплывает гейт: одно нажатие — заявления о возврате
 *     паевого взноса имуществом по всем строкам уходят на повестку совета.
 *  3. Совет решает (робот — за секунды у стойки, люди — когда соберутся),
 *     пайщик подписывает акт, оператор закрывает выдачу второй подписью —
 *     стол выдачи делает это сам, как только акт пайщика появился.
 */

const props = defineProps<{
  modelValue: boolean;
  orders: MarketplaceOrderIssuanceView[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'opened'): void;
}>();

// Редактируемый факт по каждой позиции, ключ — id заказа.
interface FactState {
  qty: number;
  price: number;
  // Частичная выдача: выдаём ли позицию в этой операции. Снятая галочка =
  // имущество остаётся на складе, акт по позиции не формируется.
  included: boolean;
}
const facts = ref<Record<string, FactState>>({});
const signing = ref(false);

// ── Докладка со склада (requirement 76): оператор добавляет в этот же акт
// опубликованный остаток КУ; пайщику он уйдёт вместе с заказом (принятие и
// подпись — у пайщика). Здесь — только набор корзины сверх заказа. ─────────
const stockPickOpen = ref(false);
const restockLines = ref<StockPickLine[]>([]);
const recipientAccount = computed(() => props.orders[0]?.orderer_account ?? '');
const issueBraname = computed(() => props.orders[0]?.delivery_braname ?? '');
// Строка докладки ведётся в единицах отпуска: и количество (число упаковок),
// и цена (за упаковку) — одной размерности, поэтому произведение прямое.
const restockTotal = computed(() =>
  restockLines.value
    .reduce((sum, l) => sum + l.quantity * Number.parseFloat(l.price_per_unit), 0)
    .toFixed(4),
);

function restockLineSum(l: StockPickLine): string {
  return (l.quantity * Number.parseFloat(l.price_per_unit)).toFixed(4);
}
function restockLineQuantityLabel(l: StockPickLine): string {
  return `${l.quantity} ${marketplaceSaleUnitLabel(l.unit_of_measure, l.stock_package_size)}`;
}
function onAddRestock(lines: StockPickLine[]): void {
  const map = new Map(restockLines.value.map((l) => [l.offer_id, { ...l }]));
  for (const line of lines) {
    const existing = map.get(line.offer_id);
    if (existing) existing.quantity += line.quantity;
    else map.set(line.offer_id, { ...line });
  }
  restockLines.value = [...map.values()];
}
function removeRestock(offer_id: string): void {
  restockLines.value = restockLines.value.filter((l) => l.offer_id !== offer_id);
}

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

/**
 * Цена, с которой открывается выдача, — цена прибытия: по ней имущество
 * лежит на складе после приёмки. Если на приёмке взяли дешевле объявленного
 * (уценка за качество), пайщик платит по цене приёмки, а разница
 * возвращается ему как недостача. Иначе выбытие со склада ушло бы по цене
 * заказа, а приход — по цене приёмки, и счёт материалов ушёл бы в минус на
 * всю разницу.
 *
 * Цены прибытия нет — заказ из остатка кооператива либо склад не
 * запрашивали: остаётся цена заказа.
 */
function defaultPriceOf(o: MarketplaceOrderIssuanceView): number {
  return o.warehouse_arrival_price != null
    ? Number.parseFloat(o.warehouse_arrival_price)
    : Number.parseFloat(o.price_per_unit);
}

function initFacts(): void {
  const next: Record<string, FactState> = {};
  for (const o of props.orders) {
    // Дефолт факта — что реально можно выдать: min(заказано, принято на склад).
    // По умолчанию выдаём то, что есть на складе; позиции с нулём на складе
    // выключены из выдачи (выдавать нечего) — оператор включит вручную нельзя.
    next[o.id] = {
      qty: Math.min(o.quantity, availableOf(o)),
      price: defaultPriceOf(o),
      included: availableOf(o) > 0,
    };
  }
  facts.value = next;
}

// Позиции, которые реально уйдут в выдачу (галочка стоит и есть что выдать).
const includedOrders = computed(() =>
  props.orders.filter((o) => facts.value[o.id]?.included && availableOf(o) > 0),
);

/**
 * Оператор правит выдачу в единицах отпуска: упаковками при упаковочном
 * отпуске, базовыми единицами по мере. Упаковку не вскрывают — если внутри
 * брак, выдают её целиком, но по сниженной цене (решение 2026-08-13).
 * Внутри формы факт хранится в базовой единице (как на цепи), поэтому здесь
 * он делится на фасовку, а обратно умножается в `onCorrectionChange`.
 */
function saleUnitsOf(o: MarketplaceOrderIssuanceView, baseQuantity: number): number {
  const size = o.package_size ?? 0;
  return size > 0 ? Math.round(baseQuantity / size) : baseQuantity;
}

const correctionRows = computed<CorrectionRow[]>(() =>
  props.orders.map((o) => {
    const f = facts.value[o.id];
    const packaged = (o.package_size ?? 0) > 0;
    return {
      sku: o.id.slice(0, 8),
      title: o.product_name || t('marketplace.issueActOpenDialog.productOfferFallback'),
      unit: marketplaceSaleUnitLabel(o.unit_of_measure, o.package_size ?? null),
      packaged,
      expected: saleUnitsOf(o, o.quantity),
      available: saleUnitsOf(o, availableOf(o)),
      location: (o.warehouse_locations ?? []).join(', ') || undefined,
      fact: saleUnitsOf(o, f?.qty ?? Math.min(o.quantity, availableOf(o))),
      expectedPrice: Number.parseFloat(o.price_per_unit),
      // Правку оператора показываем как есть, до неё — цену прибытия
      // (см. defaultPriceOf).
      factPrice: f?.price ?? defaultPriceOf(o),
      // Цену при выдаче можно только снизить: потолок — цена, с которой
      // открылась выдача (цена прибытия, у остатка — цена заказа).
      maxPrice: defaultPriceOf(o),
      included: f?.included ?? availableOf(o) > 0,
    };
  }),
);

// Итоговая сумма к выдаче — только по выбранным к выдаче позициям.
const totalFactCost = computed<string>(() => {
  let sum = 0;
  for (const o of includedOrders.value) {
    const f = facts.value[o.id];
    // Цена факта — за единицу отпуска (за упаковку при упаковочном отпуске),
    // количество — в базовой единице: перемножать напрямую нельзя.
    if (f) sum += marketplaceLineCost(f.qty, f.price, o.package_size ?? null);
  }
  return sum.toFixed(4);
});

// Ставка обеспечительной части — для оценки возврата/доплаты при расхождении
// факта и для показа состава суммы (стоимость имущества + обеспечительная
// часть) оператору и пайщику.
const feePercent = ref(0);

// Стоимость выдаваемого имущества показываем отдельно от суммы к оплате —
// обеспечительная часть идёт сверх неё (та же формула, что в каталоге и
// корзине, requirement b6); раньше на этом экране её не видели ни оператор,
// ни пайщик на следующей подписи (жалоба 2026-08-02).
const totalFactCostWithFee = computed(() => applyMembershipFee(Number(totalFactCost.value), feePercent.value));
const membershipFeeAmount = computed(() => totalFactCostWithFee.value - Number(totalFactCost.value));

// Недосдача видна сразу: сколько вернётся пайщику в кошелёк Стола заказов
// (остаток резерва + пропорциональная часть взноса), при факте больше заказа —
// сколько спишется с паевого.
const issuanceDiff = computed(() =>
  computeIssuanceDiff(
    includedOrders.value.map((o) => {
      const f = facts.value[o.id];
      return {
        orderedTotal: Number.parseFloat(o.total_cost),
        factTotal: f
          ? marketplaceLineCost(f.qty, f.price, o.package_size ?? null)
          : Number.parseFloat(o.total_cost),
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

// Под именем — учётное имя, если имя пайщика известно (иначе оно уже в шапке).
const recipientMeta = computed(() => {
  const account = props.orders[0]?.orderer_account ?? '';
  return account && account !== recipientName.value ? account : '';
});

function rub(value: number | string): string {
  return `${formatAsset2Digits(Number(value).toFixed(4))} ₽`;
}

// Сводка справа: сначала сколько выдаётся и что остаётся на складе, затем
// расчёт по пути денег — стоимость имущества, обеспечительная часть, возврат
// или доплата по факту, докладка. Итог к оплате карточка ставит крупно.
const summaryFacts = computed(() => {
  const list = [
    {
      label: t('marketplace.issueActOpenDialog.selectedLabel'),
      value: t('marketplace.issueActOpenDialog.selectedValue', { selected: includedCount.value, total: positionsCount.value }),
    },
  ];
  if (leftCount.value > 0) {
    list.push({
      label: t('marketplace.issueActOpenDialog.leftOnStockLabel'),
      value: t('marketplace.issueActOpenDialog.leftCountText', { count: leftCount.value }),
    });
  }
  return list;
});

const summaryLines = computed(() => {
  const lines: Array<{ label: string; value: string }> = [
    { label: t('marketplace.issueActOpenDialog.costLabel'), value: rub(totalFactCost.value) },
  ];
  if (feePercent.value > 0) {
    lines.push({
      label: t('marketplace.issueActOpenDialog.targetFeeHeader', { percent: feePercent.value }),
      value: rub(membershipFeeAmount.value),
    });
  }
  if (issuanceDiff.value.refund > 0) {
    lines.push({ label: t('marketplace.issueActOpenDialog.refundToWalletLabel'), value: rub(issuanceDiff.value.refund) });
  }
  if (issuanceDiff.value.surcharge > 0) {
    lines.push({ label: t('marketplace.issueActOpenDialog.surchargeLabel'), value: rub(issuanceDiff.value.surcharge) });
  }
  if (restockLines.value.length) {
    lines.push({ label: t('marketplace.issueActOpenDialog.restockLabel'), value: rub(restockTotal.value) });
  }
  return lines;
});

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
    return t('marketplace.issueActOpenDialog.warnUnselectedText');
  }
  if (anyOverStock.value) {
    const over = includedOrders.value.filter((o) => (facts.value[o.id]?.qty ?? 0) > availableOf(o));
    return t('marketplace.issueActOpenDialog.overStockError', { positions: names(over) });
  }
  const zeroQty = includedOrders.value.filter((o) => (facts.value[o.id]?.qty ?? 0) <= 0);
  if (zeroQty.length) {
    return t('marketplace.issueActOpenDialog.zeroQtyError', { positions: names(zeroQty) });
  }
  const zeroPrice = includedOrders.value.filter((o) => (facts.value[o.id]?.price ?? 0) <= 0);
  if (zeroPrice.length) {
    return t('marketplace.issueActOpenDialog.zeroPriceError', { positions: names(zeroPrice) });
  }
  return null;
});

watch(
  () => [props.modelValue, props.orders.map((o) => o.id).join(',')],
  ([visible]) => {
    if (visible && props.orders.length) {
      initFacts();
      restockLines.value = [];
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
  // Таблица отдаёт факт в единицах отпуска — возвращаем его в базовую
  // единицу, в которой заказ живёт в БД и на цепи.
  const packageSize = order?.package_size ?? 0;
  const factBase = packageSize > 0 ? Math.max(0, payload.fact) * packageSize : payload.fact;
  f.qty = Math.min(Math.max(0, factBase), ceiling);
  // Цену поднять нельзя — бэкенд и контракт откажут; снижение уйдёт уценкой.
  // Форма поправляет ввод к потолку сразу, как и количество к складу.
  if (payload.factPrice !== undefined) {
    const priceCeiling = order ? defaultPriceOf(order) : Number.POSITIVE_INFINITY;
    f.price = Math.min(Math.max(0, payload.factPrice), priceCeiling);
  }
  facts.value = { ...facts.value, [id]: f };
  // Акты зависят от факта — сбрасываем устаревший превью.
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
}

async function confirm(): Promise<void> {
  if (!props.orders.length) return;
  if (!allValid.value) {
    FailAlert(new Error(t('marketplace.error.issueFactsNotPositive')));
    return;
  }
  if (!recipientAccount.value || !issueBraname.value) {
    FailAlert(new Error(t('marketplace.error.issueRecipientMissing')));
    return;
  }
  signing.value = true;
  try {
    // 1) Обычные заказы пайщика → строки бандла order_items с фактом.
    const order_items: StockBundleOrderLine[] = includedOrders.value.map((o) => {
      const f = facts.value[o.id];
      return { order_id: o.id, actual_quantity: f.qty, actual_unit_price: String(f.price) };
    });

    // 2) Докладка со склада → строки бандла items (заказ родится на подписи пайщика).
    let items: StockBundleStockLine[] = [];
    if (restockLines.value.length) {
      const payloads = await getStockIssuancePayloads({
        braname: issueBraname.value,
        member_account: recipientAccount.value,
        // Фасовка едет с каждой строкой: без неё бэкенд не примет докладку
        // упаковочного остатка (упаковку нельзя дробить).
        items: restockLines.value.map((l) => ({
          offer_id: l.offer_id,
          quantity: l.quantity,
          package_id: l.package_id,
        })),
      });
      items = payloads.map((p) => ({
        offer_id: p.offer_id,
        quantity: p.quantity,
        package_id: p.package_id,
        order_hash: p.order_hash,
      }));
    }

    // 3) Один бандл — пайщику уйдут заявления на подпись одним нажатием.
    await createStockProposal({
      braname: issueBraname.value,
      member_account: recipientAccount.value,
      items,
      order_items,
    });
    restockLines.value = [];

    signing.value = false;
    emit('opened');
    const total = order_items.length + items.length;
    const tail = leftCount.value > 0 ? t('marketplace.issueActOpenDialog.leftOnStockText', { count: leftCount.value }) : '';
    SuccessAlert(t('marketplace.issueActOpenDialog.sentToMemberMessage', { count: total, note: tail }));
    emit('update:modelValue', false);
  } catch (e) {
    signing.value = false;
    FailAlert(e, t('marketplace.issueActOpenDialog.sendError'));
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
//- Рабочая страница выдачи на холсте, как приёмка и подписи актов. Зоны:
//- шапка (процесс, пайщик) → позиции слева (сверка и докладка со склада) →
//- сводка справа (сколько выдаётся, расчёт, итог крупно, действия).
BaseDialog(
  :model-value='modelValue',
  maximized,
  canvas,
  hide-close-button,
  @update:model-value='(v: boolean) => emit("update:modelValue", v)'
)
  ActDialogLayout(
    v-if='modelValue',
    :eyebrow='$t("marketplace.issueActOpenDialog.dialogTitle")',
    :title='recipientName',
    :meta='recipientMeta',
    :avatar-name='recipientName',
    :panel-title='$t("marketplace.issueActOpenDialog.itemsHeader", { count: positionsCount })',
    closable,
    @close='cancel'
  )
    template(#panel-actions)
      BaseButton(variant='secondary', size='sm', @click='stockPickOpen = true')
        template(#icon-left)
          q-icon(name='add_shopping_cart', size='18px')
        | {{ $t('marketplace.issueActOpenDialog.addFromStockButton') }}

    template(#lead)
      | {{ $t('marketplace.issueActOpenDialog.instructionLine1') }}
      | {{ $t('marketplace.issueActOpenDialog.instructionLine2') }}
      | {{ $t('marketplace.issueActOpenDialog.instructionLine3') }}

    CorrectionTable(:rows='correctionRows', selectable, @change='onCorrectionChange', @toggle='onCorrectionToggle')

    .issue-act__restock(v-if='restockLines.length')
      .issue-act__restock-head
        BaseBadge(variant='info') {{ $t('marketplace.issueActOpenDialog.restockLabel') }}
      .issue-act__restock-row(v-for='l in restockLines', :key='l.offer_id')
        .issue-act__restock-info
          span.issue-act__restock-name {{ l.product_name }}
          span.issue-act__restock-meta {{ formatAsset2Digits(l.price_per_unit) }} ₽ × {{ restockLineQuantityLabel(l) }}
        .issue-act__restock-right
          span.issue-act__restock-sum {{ formatAsset2Digits(restockLineSum(l)) }} ₽
          BaseButton(
            variant='ghost',
            icon-only,
            :aria-label='$t("common.action.delete")',
            @click='removeRestock(l.offer_id)'
          )
            template(#icon-left)
              q-icon(name='close', size='18px')

    template(#aside)
      ActSummaryCard(
        :eyebrow='$t("marketplace.issueActOpenDialog.asideTitle")',
        :facts='summaryFacts',
        :lines='summaryLines',
        :total-label='$t("marketplace.issueActOpenDialog.totalToPayLabel")',
        :total='rub(totalFactCostWithFee)'
      )
        .issue-act__blocker(v-if='blockReason')
          q-icon(name='info', size='18px')
          span {{ blockReason }}
        template(#actions)
          BaseButton(
            block,
            variant='primary',
            :loading='signing',
            :disabled='!allValid || signing',
            @click='confirm'
          )
            template(#icon-left)
              q-icon(name='send', size='18px')
            | {{ $t('marketplace.issueActOpenDialog.sendForSignatureButton') }}
          BaseButton(block, variant='secondary', @click='cancel') {{ $t('common.action.close') }}

  StockPickDialog(
    v-model='stockPickOpen',
    :braname='issueBraname',
    @add='onAddRestock'
  )
</template>

<style scoped lang="scss">
.issue-act {
  // Докладка со склада — раздел той же карточки позиций под таблицей сверки:
  // линия сверху, без своей рамки (рамка в рамке канон запрещает), смысл
  // раздела несёт бейдж в его шапке.
  &__restock {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px) var(--p-3, 12px) 0;
    border-top: 1px solid var(--p-line);

    &-head {
      display: flex;
    }

    &-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--p-2, 8px);
    }

    &-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    &-name {
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink);
      overflow-wrap: break-word;
    }

    &-meta {
      font-size: var(--p-fs-meta, 12px);
      color: var(--p-ink-3);
      font-variant-numeric: tabular-nums;
    }

    &-right {
      display: flex;
      align-items: center;
      gap: var(--p-2, 8px);
      flex: 0 0 auto;
    }

    &-sum {
      font-weight: 600;
      color: var(--p-ink);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  }

  // Причина, по которой отправка недоступна, — в сводке над итогом, рядом с
  // кнопкой, которую она объясняет.
  &__blocker {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
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
}
</style>
