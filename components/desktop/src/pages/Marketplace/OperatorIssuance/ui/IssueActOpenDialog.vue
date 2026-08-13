<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseBadge, BaseDialog } from 'src/shared/ui/base';
import { ActDialogLayout } from 'src/widgets/Marketplace/ActDialogLayout';
import { CorrectionTable, type CorrectionRow } from 'src/widgets/Marketplace/CorrectionTable';
import {
  useActsPreview,
  getMembershipFeePercent,
  applyMembershipFee,
  computeIssuanceDiff,
  marketplaceLineCost,
} from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import {
  getChairmanSignablePayload,
  getStockIssuancePayloads,
  createStockProposal,
  type CreateStockProposalInput,
  type MarketplaceOrderIssuanceView,
} from '../api';

// Подписанный signiss1-акт в строке бандла — тип берём прямо из SDK-входа.
type StockBundleStockLine = NonNullable<CreateStockProposalInput['items']>[number];
type StockBundleOrderLine = NonNullable<CreateStockProposalInput['order_items']>[number];
import StockPickDialog, { type StockPickLine } from './StockPickDialog.vue';

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
 * ЕДИНЫЙ ПУТЬ ВЫДАЧИ: оператор подписывает АПП-выдачи первой подписью (signiss1)
 * по выдаваемым заказам И докладке со склада и складывает всё в ОДИН бандл
 * (оффчейн, через БД). На цепи до подписи пайщика НИЧЕГО не происходит, поэтому
 * отмена пайщиком = отказ от бандла без он-чейн отката, а выдача (signiss1+
 * signiss2) уходит на цепь только при контрподписи получения пайщиком у стойки.
 *
 * Поток:
 *  1. Оператор корректирует количество/цену в сводной таблице сверки (строка на
 *     позицию, предзаполнена заказом) и при желании добавляет докладку со склада.
 *  2. «Подписать и отправить пайщику» — UI по каждой позиции формирует акт на
 *     фактическое количество, подписывает ключом оператора (signatureId=1) и
 *     отправляет единым `createStockProposal`. Пайщику немедленно приходит один
 *     акт на подпись получения (карточка в гейте «подпись на месте»).
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
  return `${l.quantity}×${marketplaceSaleUnitLabel(l.unit_of_measure, l.stock_package_size)}`;
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
      title: o.product_name || 'Товар по предложению',
      unit: marketplaceSaleUnitLabel(o.unit_of_measure, o.package_size ?? null),
      packaged,
      expected: saleUnitsOf(o, o.quantity),
      available: saleUnitsOf(o, availableOf(o)),
      location: (o.warehouse_locations ?? []).join(', ') || undefined,
      fact: saleUnitsOf(o, f?.qty ?? Math.min(o.quantity, availableOf(o))),
      expectedPrice: Number.parseFloat(o.price_per_unit),
      // Факт считается от цены прибытия: если на приёмке имущество взяли
      // дешевле объявленного, пайщик платит по цене приёмки, а разница
      // возвращается ему как недостача. Цены прибытия нет (заказ из остатка
      // либо склад не запрашивали) — остаётся цена заказа.
      factPrice:
        f?.price ??
        (o.warehouse_arrival_price != null
          ? Number.parseFloat(o.warehouse_arrival_price)
          : Number.parseFloat(o.price_per_unit)),
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

// Ставка членского взноса — для оценки возврата/доплаты при расхождении факта
// и для показа состава суммы (себестоимость + взнос) оператору и пайщику.
const feePercent = ref(0);

// Себестоимость выдаваемого показываем отдельно от суммы к оплате — пайщик
// платит взнос сверх себестоимости (та же формула, что в каталоге/корзине,
// requirement b6); раньше на этом экране взнос не был виден вообще ни
// оператору, ни пайщику на следующей подписи (жалоба 2026-08-02).
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
  if (!recipientAccount.value || !issueBraname.value) {
    FailAlert(new Error('Не определён получатель или пункт выдачи.'));
    return;
  }
  signing.value = true;
  const docSigner = new Classes.Document(wifKey);
  try {
    // ЕДИНЫЙ ПУТЬ: оператор подписывает АПП-выдачи первой подписью (signiss1) по
    // выдаваемым позициям И докладке, и кладёт всё в ОДИН бандл (оффчейн, в БД).
    // На цепи до подписи пайщика НИЧЕГО не происходит — поэтому отмена пайщиком
    // = отказ от бандла, без он-чейн отката. Выдача (signiss1+signiss2) уходит
    // в цепь только когда пайщик контрподписывает акт у стойки.

    // 1) Обычные заказы пайщика → строки бандла order_items.
    const order_items: StockBundleOrderLine[] = [];
    for (const o of includedOrders.value) {
      const f = facts.value[o.id];
      const priceStr = String(f.price);
      const generated = await getChairmanSignablePayload({
        order_id: o.id,
        actual_quantity: f.qty,
        actual_unit_price: priceStr,
      });
      const signiss1_act = (await docSigner.signDocument(
        generated,
        globalStore.username,
        1,
      )) as StockBundleOrderLine['signiss1_act'];
      order_items.push({
        order_id: o.id,
        actual_quantity: f.qty,
        actual_unit_price: priceStr,
        signiss1_act,
      });
    }

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
      items = await Promise.all(
        payloads.map(async (p) => ({
          offer_id: p.offer_id,
          quantity: p.quantity,
          package_id: p.package_id,
          order_hash: p.order_hash,
          signiss1_act: (await docSigner.signDocument(
            p.signiss1_document,
            globalStore.username,
            1,
          )) as StockBundleStockLine['signiss1_act'],
        })),
      );
    }

    // 3) Один бандл — пайщику уйдёт один акт на подпись (получение).
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
    const tail = leftCount.value > 0 ? ` Осталось на складе позиц.: ${leftCount.value}.` : '';
    SuccessAlert(`Акт отправлен пайщику на подпись (${total} позиц.) — ждём подтверждение получения.${tail}`);
    emit('update:modelValue', false);
  } catch (e) {
    signing.value = false;
    FailAlert(e, 'Не удалось отправить акт пайщику на подпись');
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Открытие выдачи пайщику"
  maximized
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  ActDialogLayout(wide)
    template(#head)
      .issue-act__who(v-if="recipientName")
        span.issue-act__name {{ recipientName }}
        span.issue-act__meta
          | К выдаче {{ includedCount }} из {{ positionsCount }}
          |  · {{ formatAsset2Digits(totalFactCostWithFee.toFixed(4)) }} ₽
          template(v-if="issuanceDiff.refund > 0")
            |  · вернётся в кошелёк {{ formatAsset2Digits(issuanceDiff.refund.toFixed(4)) }} ₽

    template(#lead)
      | Сверьте имущество с заказами пайщика и отметьте галочкой то, что он
      | забирает сейчас. «План» — сколько заказано, «Принято» — сколько на складе
      | (выдать больше нельзя). Снятые позиции остаются на складе.

    template(v-if="!showActs")
      .issue-act__toolbar
        BaseButton(variant="ghost", @click="stockPickOpen = true")
          template(#icon-left)
            q-icon(name="add_shopping_cart", size="18px")
          | Со склада
      CorrectionTable(:rows="correctionRows", selectable, @change="onCorrectionChange", @toggle="onCorrectionToggle")

      .issue-act__restock(v-if="restockLines.length")
        .issue-act__restock-head
          BaseBadge(variant="info") Доложено со склада
        .issue-act__restock-row(v-for="l in restockLines", :key="l.offer_id")
          .issue-act__restock-info
            span.issue-act__restock-name {{ l.product_name }}
            span.issue-act__restock-meta {{ formatAsset2Digits(l.price_per_unit) }} ₽ × {{ restockLineQuantityLabel(l) }}
          .issue-act__restock-right
            span.issue-act__restock-sum {{ formatAsset2Digits(restockLineSum(l)) }} ₽
            BaseButton(variant="ghost", @click="removeRestock(l.offer_id)")
              q-icon(name="close", size="18px")

    .issue-act__preview(v-else, v-html="previewHtml")

    template(#after)
      .issue-act__totals(v-if="!showActs")
        .issue-act__sum
          span.issue-act__sum-label Себестоимость ({{ includedCount }} из {{ positionsCount }} позиц.)
          span.issue-act__sum-value {{ formatAsset2Digits(totalFactCost) }} ₽
        .issue-act__sum(v-if="feePercent > 0")
          span.issue-act__sum-label Кооперативная наценка ({{ feePercent }}%)
          span.issue-act__sum-value {{ formatAsset2Digits(membershipFeeAmount.toFixed(4)) }} ₽
        .issue-act__sum
          span.issue-act__sum-label Итого к оплате
          span.issue-act__sum-value {{ formatAsset2Digits(totalFactCostWithFee.toFixed(4)) }} ₽
        .issue-act__sum(v-if="leftCount > 0")
          span.issue-act__sum-label Остаётся на складе
          span.issue-act__sum-value {{ leftCount }} позиц.
        .issue-act__sum(v-if="issuanceDiff.refund > 0")
          span.issue-act__sum-label Вернётся в кошелёк Стола заказов
          span.issue-act__sum-value {{ formatAsset2Digits(issuanceDiff.refund.toFixed(4)) }} ₽
        .issue-act__sum(v-if="issuanceDiff.surcharge > 0")
          span.issue-act__sum-label Доплата по факту (спишется с паевого)
          span.issue-act__sum-value {{ formatAsset2Digits(issuanceDiff.surcharge.toFixed(4)) }} ₽
        .issue-act__sum(v-if="restockLines.length")
          span.issue-act__sum-label Доложено со склада
          span.issue-act__sum-value {{ formatAsset2Digits(restockTotal) }} ₽

      .issue-act__blocker(v-if="!showActs && blockReason")
        q-icon(name="info", size="18px")
        span {{ blockReason }}

  StockPickDialog(
    v-model="stockPickOpen"
    :braname="issueBraname"
    @add="onAddRestock"
  )

  template(#footer)
    BaseButton(variant="ghost", @click="cancel") Закрыть
    BaseButton(
      variant="ghost"
      :loading="previewLoading"
      :disabled="!allValid"
      @click="toggleActs"
    )
      template(#icon-left)
        q-icon(name="description", size="18px")
      | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
    BaseButton(
      variant="primary"
      :loading="signing"
      :disabled="!allValid || signing"
      @click="confirm"
    )
      template(#icon-left)
        q-icon(name="draw", size="18px")
      | Подписать и отправить пайщику
</template>

<style scoped lang="scss">
.issue-act {
  &__who {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__toolbar {
    display: flex;
    justify-content: flex-end;
  }

  &__restock {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px);
    border: 1px solid var(--p-info-line, var(--p-line));
    border-radius: var(--p-r-md, 12px);
    background: var(--p-info-soft);

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
    }
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
    max-height: 55vh;
    overflow: auto;
  }
}

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
</style>
