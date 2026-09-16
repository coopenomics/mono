/**
 * Оборот Стола заказов за период — общий расчёт для «Экономики» кооператива и
 * «Экономики участка».
 *
 * Две стороны оборота живут в разных сущностях, и это не техническая деталь, а
 * существо дела:
 *   - приход — приёмка имущества на склад участка (позиции склада несут цену
 *     прибытия и дату приёмки);
 *   - выдача — исполненный заказ (только у него есть факт выдачи, дата
 *     получения заказчиком и наценка кооператива).
 * Поэтому период считается по дате приёмки для прихода и по дате получения
 * для выдачи — у склада своей даты выдачи нет вовсе.
 *
 * Суммы считаются единственной формулой платформы `marketplaceLineCost`:
 * цена задана за единицу отпуска, и «количество × цена» при отпуске упаковкой
 * завышало бы сумму ровно в размер упаковки.
 */
import { marketplaceLineCost } from './line-cost';

/** Позиция склада, нужная обороту. Структурный тип — вью SDK подходит как есть. */
export interface TurnoverInventoryItem {
  braname: string;
  offer_id?: string | null;
  product_name_snapshot: string;
  quantity_per_label: number;
  package_size?: number | null;
  arrival_price?: string | null;
  unit_of_measure?: string | null;
  delivery_point_name?: string | null;
  delivery_point_address?: string | null;
  received_at?: unknown;
  created_at?: unknown;
}

/** Заказ, нужный обороту. */
export interface TurnoverOrder {
  status: string;
  delivery_braname: string;
  offer_id?: string | null;
  product_name?: string | null;
  quantity: number;
  package_size?: number | null;
  unit_of_measure?: string | null;
  delivery_point_name?: string | null;
  delivery_point_address?: string | null;
  total_cost?: string | null;
  membership_fee?: string | null;
  received_at?: unknown;
  issuance_fact?: { actual_quantity: number; fact_cost: string } | null;
}

export interface TurnoverRow {
  key: string;
  title: string;
  branchName: string;
  branchAddress: string | null;
  /** Единица измерения позиции — как она пришла с бэкенда. */
  unitOfMeasure: string | null;
  packageSize: number | null;
  acceptedUnits: number;
  acceptedAmount: number;
  issuedUnits: number;
  issuedAmount: number;
  /** Наценка кооператива с выданного — доход участка выдачи. */
  feeAmount: number;
}

export interface TurnoverTotals {
  acceptedAmount: number;
  issuedAmount: number;
  feeAmount: number;
}

/** Статус исполненного заказа: имущество получено заказчиком. */
const ORDER_RECEIVED = 'RECEIVED';

function timeOf(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const t = new Date(String(value)).getTime();
  return Number.isFinite(t) ? t : null;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyRow(key: string): TurnoverRow {
  return {
    key,
    title: '',
    branchName: '',
    branchAddress: null,
    unitOfMeasure: null,
    packageSize: null,
    acceptedUnits: 0,
    acceptedAmount: 0,
    issuedUnits: 0,
    issuedAmount: 0,
    feeAmount: 0,
  };
}

/** Попадает ли событие в период; `sinceMs` = null — период не ограничен. */
function withinPeriod(at: number | null, sinceMs: number | null): boolean {
  return sinceMs === null || (at !== null && at >= sinceMs);
}

/** Ключ свода: позиция на конкретном участке. Без предложения — по наименованию. */
function turnoverKey(braname: string, offerId: string | null | undefined, title: string): string {
  return `${braname}::${offerId ?? title}`;
}

/** Наименование участка для показа; пусто — служебное имя участка. */
function branchNameOf(name: string | null | undefined, braname: string): string {
  return name?.trim() || braname;
}

/**
 * Сколько единиц реально выдано. Факт выдачи важнее заказанного: при
 * недопоставке выдано меньше, и оборотом прошло именно выданное.
 */
function issuedUnitsOf(order: TurnoverOrder): number {
  return order.issuance_fact?.actual_quantity ?? order.quantity;
}

/** Сумма выданного: по факту выдачи, а без факта — по стоимости заказа. */
function issuedAmountOf(order: TurnoverOrder): number {
  return order.issuance_fact
    ? toNumber(order.issuance_fact.fact_cost)
    : toNumber(order.total_cost);
}

/** Общие реквизиты позиции: заполняются первым, кто их принёс — приход или выдача. */
function fillMeta(
  row: TurnoverRow,
  meta: {
    title: string;
    branchName: string;
    branchAddress?: string | null;
    unitOfMeasure?: string | null;
    packageSize?: number | null;
  },
): void {
  row.title ||= meta.title;
  row.branchName ||= meta.branchName;
  row.branchAddress ??= meta.branchAddress ?? null;
  row.unitOfMeasure ??= meta.unitOfMeasure ?? null;
  row.packageSize ??= meta.packageSize ?? null;
}

/** Приход: что и на какую сумму принято на склад за период. */
function addInventory(
  map: Map<string, TurnoverRow>,
  inventory: TurnoverInventoryItem[],
  sinceMs: number | null,
): void {
  for (const item of inventory) {
    const at = timeOf(item.received_at) ?? timeOf(item.created_at);
    if (!withinPeriod(at, sinceMs)) continue;

    const key = turnoverKey(item.braname, item.offer_id, item.product_name_snapshot);
    const row = map.get(key) ?? emptyRow(key);
    fillMeta(row, {
      title: item.product_name_snapshot,
      branchName: branchNameOf(item.delivery_point_name, item.braname),
      branchAddress: item.delivery_point_address,
      unitOfMeasure: item.unit_of_measure,
      packageSize: item.package_size,
    });
    row.acceptedUnits += item.quantity_per_label;
    row.acceptedAmount += marketplaceLineCost(
      item.quantity_per_label,
      item.arrival_price,
      item.package_size,
    );
    map.set(key, row);
  }
}

/** Выдача: что и на какую сумму получили пайщики за период, и наценка с этого. */
function addOrders(
  map: Map<string, TurnoverRow>,
  orders: TurnoverOrder[],
  sinceMs: number | null,
): void {
  for (const order of orders) {
    if (order.status !== ORDER_RECEIVED) continue;
    if (!withinPeriod(timeOf(order.received_at), sinceMs)) continue;

    const title = order.product_name || 'Товар по предложению';
    const key = turnoverKey(order.delivery_braname, order.offer_id, title);
    const row = map.get(key) ?? emptyRow(key);
    fillMeta(row, {
      title,
      branchName: branchNameOf(order.delivery_point_name, order.delivery_braname),
      branchAddress: order.delivery_point_address,
      unitOfMeasure: order.unit_of_measure,
      packageSize: order.package_size,
    });
    row.issuedUnits += issuedUnitsOf(order);
    row.issuedAmount += issuedAmountOf(order);
    row.feeAmount += toNumber(order.membership_fee);
    map.set(key, row);
  }
}

/**
 * Свод оборота по парам «позиция × пункт выдачи».
 *
 * `sinceMs` — начало периода в миллисекундах; `null` — за всё время.
 */
export function buildTurnover(
  inventory: TurnoverInventoryItem[],
  orders: TurnoverOrder[],
  sinceMs: number | null,
): { rows: TurnoverRow[]; totals: TurnoverTotals } {
  const map = new Map<string, TurnoverRow>();
  addInventory(map, inventory, sinceMs);
  addOrders(map, orders, sinceMs);

  const rows = [...map.values()].sort(
    (a, b) => b.issuedAmount + b.acceptedAmount - (a.issuedAmount + a.acceptedAmount),
  );

  const totals = rows.reduce<TurnoverTotals>(
    (sum, r) => ({
      acceptedAmount: sum.acceptedAmount + r.acceptedAmount,
      issuedAmount: sum.issuedAmount + r.issuedAmount,
      feeAmount: sum.feeAmount + r.feeAmount,
    }),
    { acceptedAmount: 0, issuedAmount: 0, feeAmount: 0 },
  );

  return { rows, totals };
}

/** Периоды, за которые смотрят оборот. `0` — за всё время. */
export const TURNOVER_PERIODS = [
  { label: 'За 7 дней', value: 7 },
  { label: 'За 30 дней', value: 30 },
  { label: 'За 90 дней', value: 90 },
  { label: 'За всё время', value: 0 },
];

/** Начало периода в миллисекундах; `null` — за всё время. */
export function turnoverSince(periodDays: number): number | null {
  return periodDays > 0 ? Date.now() - periodDays * 86_400_000 : null;
}
