<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseBadge, BaseCheckbox, BaseDialog, BaseInput, type BaseBadgeVariant } from 'src/shared/ui/base';
import {
  ActDialogLayout,
  ActLineItem,
  ActLinesTable,
  ActSummaryCard,
  type ActLinesColumn,
} from 'src/widgets/Marketplace/ActDialogLayout';
import {
  getMembershipFeePercent,
  applyMembershipFee,
  computeIssuanceDiff,
  marketplaceLineCost,
  SHOW_MONEY_FLOW_LINES,
} from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceSaleUnitLabel, marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import {
  getStockIssuancePayloads,
  createStockProposal,
  issuancePickScan,
  type IssuancePickScanView,
  type CreateStockProposalInput,
  type MarketplaceOrderIssuanceView,
} from '../api';
import { t } from 'src/shared/i18n';
import { Zeus } from '@coopenomics/sdk';
import { playScanTone } from 'src/shared/lib/marketplace/scan-tone';
import { BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner';
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog';

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
 * он делится на фасовку, а обратно умножается в `onFactInput`.
 */
function saleUnitsOf(o: MarketplaceOrderIssuanceView, baseQuantity: number): number {
  const size = o.package_size ?? 0;
  return size > 0 ? Math.round(baseQuantity / size) : baseQuantity;
}

function isPackaged(o: MarketplaceOrderIssuanceView): boolean {
  return (o.package_size ?? 0) > 0;
}

// Строка выдачи на общей таблице актов: галка · позиция · выдать · цена ·
// сумма строки · сверка. Что заказано, сколько на складе и где лежит —
// мета-строкой под названием: семь колонок фиксированной ширины не
// помещались в карточку рядом со сводкой (слово владельца 01.11.2026).
const issueColumns = computed<ActLinesColumn[]>(() => [
  { key: 'check', label: '', width: 'var(--p-6, 24px)' },
  { key: 'item', label: t('marketplace.issueActOpenDialog.columnItem'), wide: true, width: 'minmax(200px, 1fr)' },
  { key: 'issue', label: t('marketplace.issueActOpenDialog.columnIssue'), width: '136px', align: 'right' },
  { key: 'price', label: t('marketplace.issueActOpenDialog.columnPrice'), width: '160px', align: 'right' },
  { key: 'sum', label: t('marketplace.issueActOpenDialog.columnSum'), width: '112px', align: 'right', strong: true },
  // Самый длинный бейдж — «Больше принятого».
  { key: 'status', label: t('marketplace.issueActOpenDialog.columnStatus'), width: '144px' },
]);

type IssueRow = { key: string; off: boolean; order: MarketplaceOrderIssuanceView };

// Строки по месту хранения: оператор обходит склад один раз, от бокса к
// боксу. Позиции без места — в конце.
const issueRows = computed<IssueRow[]>(() =>
  [...props.orders]
    .sort((a, b) => {
      const la = (a.warehouse_locations ?? []).join(', ');
      const lb = (b.warehouse_locations ?? []).join(', ');
      if (!la || !lb) return la ? -1 : lb ? 1 : 0;
      return la.localeCompare(lb, 'ru', { numeric: true });
    })
    .map((o) => ({ key: o.id, off: !isIncluded(o), order: o })),
);

function isIncluded(o: MarketplaceOrderIssuanceView): boolean {
  return (facts.value[o.id]?.included ?? availableOf(o) > 0) && availableOf(o) > 0;
}

/** Короткая единица отпуска для поля «Выдать»: «упак.», «шт», «кг». */
function saleUnitShort(o: MarketplaceOrderIssuanceView): string {
  return isPackaged(o) ? t('marketplace.issueActOpenDialog.packShort') : marketplaceUnitShort(o.unit_of_measure);
}

/** Мета-строка позиции: единица отпуска, заказано, на складе, место хранения. */
function lineMeta(o: MarketplaceOrderIssuanceView): string {
  const unit = marketplaceSaleUnitLabel(o.unit_of_measure, o.package_size ?? null);
  const parts = [
    unit,
    t('marketplace.issueActOpenDialog.lineMetaText', {
      ordered: saleUnitsOf(o, o.quantity),
      available: saleUnitsOf(o, availableOf(o)),
    }),
  ];
  const location = (o.warehouse_locations ?? []).join(', ');
  if (location) parts.push(location);
  return parts.join(' · ');
}

/** Выдаётся в единицах отпуска — то, что видит оператор в поле. */
function factUnits(o: MarketplaceOrderIssuanceView): number {
  return saleUnitsOf(o, facts.value[o.id]?.qty ?? Math.min(o.quantity, availableOf(o)));
}

function factPrice(o: MarketplaceOrderIssuanceView): number {
  return facts.value[o.id]?.price ?? defaultPriceOf(o);
}

/** Сумма строки по факту и цене; снятая строка — ноль. */
function lineSum(o: MarketplaceOrderIssuanceView): number {
  if (!isIncluded(o)) return 0;
  const f = facts.value[o.id];
  return f ? marketplaceLineCost(f.qty, f.price, o.package_size ?? null) : 0;
}

// Шаг ввода количества: упаковка и штука неделимы (1), вес и объём — дробный
// шаг 0.001, чтобы браузер не отвергал дробное значение.
function stepFor(o: MarketplaceOrderIssuanceView): string {
  if (isPackaged(o)) return '1';
  const unit = marketplaceUnitShort(o.unit_of_measure);
  // i18n-ignore: единица измерения из данных предложения, не надпись
  return unit === 'шт' || unit === 'шт.' ? '1' : '0.001';
}

// Сверка строки: нет на складе / больше принятого / совпадает с заказом /
// недостача / избыток. Сравнивается факт в единицах отпуска с заказом.
function lineStatus(o: MarketplaceOrderIssuanceView): { label: string; variant: BaseBadgeVariant } {
  const available = saleUnitsOf(o, availableOf(o));
  const fact = factUnits(o);
  const delta = fact - saleUnitsOf(o, o.quantity);
  if (available <= 0) return { label: t('marketplace.issueActOpenDialog.statusOutOfStock'), variant: 'neg' };
  if (fact > available) return { label: t('marketplace.issueActOpenDialog.statusOverStock'), variant: 'neg' };
  if (delta === 0) return { label: t('marketplace.issueActOpenDialog.statusMatch'), variant: 'pos' };
  if (delta < 0) return { label: t('marketplace.issueActOpenDialog.statusShort'), variant: 'warn' };
  return { label: t('marketplace.issueActOpenDialog.statusOver'), variant: 'info' };
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

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
  // Строки о движении денег скрыты переключателем, описание — в money-flow-lines.ts.
  if (SHOW_MONEY_FLOW_LINES && issuanceDiff.value.refund > 0) {
    lines.push({ label: t('marketplace.issueActOpenDialog.refundToWalletLabel'), value: rub(issuanceDiff.value.refund) });
  }
  if (SHOW_MONEY_FLOW_LINES && issuanceDiff.value.surcharge > 0) {
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
      pickedLabels.value = {};
      scanMessage.value = null;
      scanCode.value = '';
      if (!feePercent.value) {
        getMembershipFeePercent()
          .then((p) => (feePercent.value = p))
          .catch(() => undefined); // нет ставки — возврат покажем без взноса
      }
    }
  },
  { immediate: false },
);

/**
 * Правка количества в единицах отпуска. Упаковку не дробим: полторы упаковки
 * не существует ни физически, ни на цепи. Ввод сразу прижимается к потолку
 * склада — выдать больше принятого нельзя, акт на большее не сформируется
 * (двойная защита с backend-гардом). Внутри формы факт хранится в базовой
 * единице, как в БД и на цепи.
 */
function onFactInput(o: MarketplaceOrderIssuanceView, raw: unknown): void {
  let units = Math.max(0, toNumber(raw));
  if (isPackaged(o)) units = Math.floor(units);
  const size = o.package_size ?? 0;
  const base = size > 0 ? units * size : units;
  const f = facts.value[o.id] ?? { qty: 0, price: defaultPriceOf(o), included: true };
  facts.value = { ...facts.value, [o.id]: { ...f, qty: Math.min(base, availableOf(o)) } };
}

/**
 * Правка цены за единицу отпуска. Цену поднять нельзя — бэкенд и контракт
 * откажут; снижение проводится уценкой. Ввод прижимается к цене, с которой
 * открылась выдача.
 */
function onPriceInput(o: MarketplaceOrderIssuanceView, raw: unknown): void {
  const f = facts.value[o.id] ?? { qty: Math.min(o.quantity, availableOf(o)), price: 0, included: true };
  const price = Math.min(Math.max(0, toNumber(raw)), defaultPriceOf(o));
  facts.value = { ...facts.value, [o.id]: { ...f, price } };
}

function onToggle(o: MarketplaceOrderIssuanceView, included: boolean): void {
  // Позицию без склада включить нельзя — выдавать нечего.
  if (included && availableOf(o) <= 0) return;
  const f = facts.value[o.id] ?? { qty: Math.min(o.quantity, availableOf(o)), price: defaultPriceOf(o), included };
  facts.value = { ...facts.value, [o.id]: { ...f, included } };
}

// ── Подбор по сканеру (99D-18). Режим мягкий: скан бокса подсказывает, где
// лежит имущество, скан этикетки подтверждает, что это оно, и сам ставит
// галку и количество. Ручная правка остаётся, отправку на подпись скан не
// блокирует. Строгий режим — после решения по этикеткам на упаковках. ──
const scanCode = ref('');
const scanBusy = ref(false);
const cameraOpen = ref(false);
const scanInput = ref<{ focus: () => void } | null>(null);
/** Отсканированные этикетки: позиция склада → заказ и количество под этикеткой. */
const pickedLabels = ref<Record<string, { order_id: string; quantity: number }>>({});
const scanMessage = ref<{ tone: 'pos' | 'neg' | 'info'; text: string } | null>(null);

const pickStarted = computed(() => Object.keys(pickedLabels.value).length > 0);

/** Найдено сканом по заказу, в базовой единице. */
function pickedBaseOf(orderId: string): number {
  return Object.values(pickedLabels.value)
    .filter((l) => l.order_id === orderId)
    .reduce((sum, l) => sum + l.quantity, 0);
}

/** Строка подбора под бейджем сверки; пусто, пока оператор не начал сканировать. */
function pickLine(o: MarketplaceOrderIssuanceView): { done: boolean; text: string } | null {
  if (!pickStarted.value || availableOf(o) <= 0) return null;
  const found = saleUnitsOf(o, pickedBaseOf(o.id));
  const target = saleUnitsOf(o, Math.min(o.quantity, availableOf(o)));
  if (found <= 0) return { done: false, text: t('marketplace.issueActOpenDialog.pickNotFound') };
  if (found >= target) return { done: true, text: t('marketplace.issueActOpenDialog.pickFound') };
  return { done: false, text: t('marketplace.issueActOpenDialog.pickPartial', { found, total: target }) };
}

function orderName(id: string): string {
  const o = props.orders.find((x) => x.id === id);
  return o?.product_name || t('marketplace.issueActOpenDialog.productOfferFallback');
}

/** Куда идти за ещё не найденным: места хранения заказов без скана. */
function remainingLocations(): string {
  const places = new Set<string>();
  for (const o of props.orders) {
    if (pickedBaseOf(o.id) > 0) continue;
    for (const l of o.warehouse_locations ?? []) places.add(l);
  }
  return [...places].join(', ');
}

function say(tone: 'pos' | 'neg' | 'info', text: string): void {
  scanMessage.value = { tone, text };
  playScanTone(tone === 'neg' ? 'error' : 'ok');
}

function applyLabel(r: IssuancePickScanView): void {
  const name = r.product_name || t('marketplace.issueActOpenDialog.productOfferFallback');
  if (!r.inventory_id || !r.order_id) return;
  if (pickedLabels.value[r.inventory_id]) {
    say('info', t('marketplace.issueActOpenDialog.pickDuplicate', { name }));
    return;
  }
  pickedLabels.value = { ...pickedLabels.value, [r.inventory_id]: { order_id: r.order_id, quantity: r.quantity ?? 0 } };
  const order = props.orders.find((o) => o.id === r.order_id);
  if (order) {
    // Количество следует за сканом: сколько этикеток найдено, столько и
    // выдаётся. Потолок — остаток склада; ручная правка остаётся.
    const f = facts.value[order.id] ?? { qty: 0, price: defaultPriceOf(order), included: true };
    facts.value = {
      ...facts.value,
      [order.id]: { ...f, included: true, qty: Math.min(pickedBaseOf(order.id), availableOf(order)) },
    };
  }
  say('pos', t('marketplace.issueActOpenDialog.pickLabelMatch', { name }));
}

/** Тексты отказов по итогу сверки; совпадение разбирается отдельно. */
const PICK_REJECTS: Partial<Record<Zeus.MarketplaceIssuancePickVerdict, (r: IssuancePickScanView, name: string, box: string) => string>> = {
  [Zeus.MarketplaceIssuancePickVerdict.OTHER_ORDER]: (_r, name) => t('marketplace.issueActOpenDialog.pickOtherOrder', { name }),
  [Zeus.MarketplaceIssuancePickVerdict.NOT_ON_WAREHOUSE]: (_r, name) => t('marketplace.issueActOpenDialog.pickNotOnWarehouse', { name }),
  [Zeus.MarketplaceIssuancePickVerdict.OTHER_BRANCH]: (r, name, box) =>
    r.target === Zeus.MarketplaceIssuancePickTarget.CONTAINER
      ? t('marketplace.issueActOpenDialog.pickBoxOtherBranch', { box })
      : t('marketplace.issueActOpenDialog.pickLabelOtherBranch', { name }),
  [Zeus.MarketplaceIssuancePickVerdict.BOX_EMPTY]: (_r, _name, box) => {
    // Бокс не тот — подсказываем, где лежит ещё не найденное.
    const where = remainingLocations();
    return where
      ? t('marketplace.issueActOpenDialog.pickBoxEmptyWhere', { box, where })
      : t('marketplace.issueActOpenDialog.pickBoxEmpty', { box });
  },
};

function applyPick(r: IssuancePickScanView): void {
  if (r.verdict === Zeus.MarketplaceIssuancePickVerdict.MATCH) {
    if (r.target === Zeus.MarketplaceIssuancePickTarget.CONTAINER) {
      const box = r.container_code ?? '';
      say('info', t('marketplace.issueActOpenDialog.pickBoxMatch', { box, names: r.order_ids.map(orderName).join(', ') }));
    } else {
      applyLabel(r);
    }
    return;
  }
  const name = r.product_name || t('marketplace.issueActOpenDialog.productOfferFallback');
  const reject = PICK_REJECTS[r.verdict];
  say('neg', reject ? reject(r, name, r.container_code ?? '') : t('marketplace.issueActOpenDialog.pickUnknown'));
}

async function onScan(raw: string): Promise<void> {
  const code = raw.trim();
  if (!code || scanBusy.value || !issueBraname.value) return;
  scanBusy.value = true;
  try {
    const result = await issuancePickScan({
      braname: issueBraname.value,
      order_ids: props.orders.map((o) => o.id),
      code,
    });
    applyPick(result);
  } catch (e) {
    playScanTone('error');
    FailAlert(e, t('marketplace.issueActOpenDialog.pickError'));
  } finally {
    scanBusy.value = false;
    scanCode.value = '';
    // Ручной сканер вводит следующий код в то же поле — фокус держим.
    scanInput.value?.focus();
  }
}

function onCameraScan(code: string): void {
  cameraOpen.value = false;
  void onScan(code);
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
  //- Во всю ширину окна: при выдаче в строке больше полей правки, чем у
  //- приёмки, и в 1180px таблица рядом со сводкой не помещалась.
  ActDialogLayout(
    v-if='modelValue',
    wide,
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

    //- Подбор по сканеру: ручной сканер вводит код в поле и жмёт Enter,
    //- камера — запасной путь. Ответ сервера — строкой под полем со звуком.
    form.issue-act__scan(@submit.prevent='onScan(scanCode)')
      BaseInput.issue-act__scan-input(
        ref='scanInput',
        v-model='scanCode',
        :placeholder='$t("marketplace.issueActOpenDialog.scanPlaceholder")',
        :disabled='scanBusy',
        autocomplete='off'
      )
        template(#prepend)
          q-icon(name='qr_code_scanner', size='20px')
        //- Камера — запасной путь, поэтому значком внутри поля, а не
        //- кнопкой рядом: основное — ручной сканер в этом же поле.
        template(#append)
          BaseButton(
            variant='ghost',
            size='sm',
            icon-only,
            type='button',
            :aria-label='$t("marketplace.issueActOpenDialog.cameraButton")',
            @click='cameraOpen = true'
          )
            template(#icon-left)
              q-icon(name='photo_camera', size='20px')
            q-tooltip {{ $t('marketplace.issueActOpenDialog.cameraButton') }}
    .issue-act__scan-result(v-if='scanMessage', :class='`issue-act__scan-result--${scanMessage.tone}`')
      q-icon(:name='scanMessage.tone === "neg" ? "error" : scanMessage.tone === "pos" ? "check_circle" : "inventory_2"', size='18px')
      span {{ scanMessage.text }}

    ActLinesTable(:columns='issueColumns', :rows='issueRows')
      template(#cell-check='{ row }')
        BaseCheckbox(
          :model-value='isIncluded(row.order)',
          :disabled='availableOf(row.order) <= 0',
          :aria-label='row.order.product_name || $t("marketplace.issueActOpenDialog.productOfferFallback")',
          @update:model-value='(v) => onToggle(row.order, !!v)'
        )
        q-tooltip(v-if='availableOf(row.order) <= 0') {{ $t('marketplace.issueActOpenDialog.outOfStockHint') }}
      template(#cell-item='{ row }')
        ActLineItem(
          :title='row.order.product_name || $t("marketplace.issueActOpenDialog.productOfferFallback")',
          :meta='lineMeta(row.order)',
          :image-url='row.order.image_url'
        )
      template(#cell-issue='{ row }')
        BaseInput(
          :model-value='factUnits(row.order)',
          type='number',
          :min='0',
          :max='saleUnitsOf(row.order, availableOf(row.order))',
          :step='stepFor(row.order)',
          :disabled='!isIncluded(row.order)',
          :suffix='saleUnitShort(row.order)',
          :aria-label='$t("marketplace.issueActOpenDialog.issueQuantityAriaLabel")',
          @update:model-value='(v) => onFactInput(row.order, v)'
        )
      template(#cell-price='{ row }')
        BaseInput(
          :model-value='factPrice(row.order)',
          type='number',
          :min='0',
          :max='defaultPriceOf(row.order)',
          :disabled='!isIncluded(row.order)',
          :suffix='isPackaged(row.order) ? $t("marketplace.issueActOpenDialog.pricePerPackage") : $t("marketplace.issueActOpenDialog.pricePerUnit")',
          :aria-label='isPackaged(row.order) ? $t("marketplace.issueActOpenDialog.priceForPackage") : $t("marketplace.issueActOpenDialog.priceForUnit")',
          @update:model-value='(v) => onPriceInput(row.order, v)'
        )
      template(#cell-sum='{ row }') {{ rub(lineSum(row.order)) }}
      template(#cell-status='{ row }')
        .issue-act__status
          BaseBadge(:variant='lineStatus(row.order).variant') {{ lineStatus(row.order).label }}
          .issue-act__pick(
            v-if='pickLine(row.order)',
            :class='{ "issue-act__pick--done": pickLine(row.order)?.done }'
          )
            q-icon(:name='pickLine(row.order)?.done ? "check_circle" : "radio_button_unchecked"', size='14px')
            span {{ pickLine(row.order)?.text }}

    .issue-act__restock(v-if='restockLines.length')
      .issue-act__restock-head
        BaseBadge(variant='info') {{ $t('marketplace.issueActOpenDialog.restockLabel') }}
      .issue-act__restock-row(v-for='l in restockLines', :key='l.offer_id')
        .issue-act__restock-info
          ActLineItem(
            :title='l.product_name',
            :meta='`${formatAsset2Digits(l.price_per_unit)} ₽ × ${restockLineQuantityLabel(l)}`',
            :image-url='l.image_url'
          )
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

  ScannerDialog(
    v-model='cameraOpen',
    :title='$t("marketplace.issueActOpenDialog.cameraTitle")',
    :formats='BARCODE_FORMATS',
    @scanned='onCameraScan'
  )

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

  // Поле сканера над таблицей во всю ширину; камера — значком внутри поля.
  // Резерв строки подсказки снят: поле стоит вплотную к ответу и таблице.
  &__scan-input {
    width: 100%;

    &:deep(.q-field--with-bottom),
    :deep(.q-field--with-bottom) {
      padding-bottom: 0;
    }

    :deep(.q-field__bottom) {
      display: none;
    }
  }

  // Ответ сканера: цвет по итогу, текст крупнее подписи — его читают с
  // полки, на ходу.
  &__scan-result {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border-radius: var(--p-r-sm, 8px);
    font-size: var(--p-fs-body, 14px);
    line-height: 1.4;

    .q-icon {
      flex-shrink: 0;
      margin-top: 1px;
    }

    &--pos {
      background: var(--p-pos-soft);
      color: var(--p-pos);
    }

    &--neg {
      background: var(--p-neg-soft);
      color: var(--p-neg);
    }

    &--info {
      background: var(--p-info-soft);
      color: var(--p-info);
    }
  }

  &__status {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--p-1, 4px);
  }

  // Ход подбора под бейджем сверки: новое о строке, а не повтор бейджа.
  &__pick {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    white-space: nowrap;

    &--done {
      color: var(--p-pos);
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
