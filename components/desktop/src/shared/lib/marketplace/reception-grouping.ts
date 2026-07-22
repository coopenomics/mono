/**
 * Группировка актов приёмки (АПП) в сводную «поставку» для подписи одним
 * действием.
 *
 * Под капотом каждый акт приёма-передачи — отдельный документ и отдельная
 * on-chain транзакция (блокчейн не проведёт сотни единиц имущества одной
 * транзакцией). Но и поставщик (первая подпись), и председатель КУ (закрывающая
 * подпись) видят и подписывают доставку ЦЕЛИКОМ: один поставщик, один КУ, один
 * способ доставки. Подпись группы = последовательный цикл по её receptions.
 *
 * Ключ группировки:
 *   • стол ПВЗ (председатель): поставщик + КУ + способ доставки + статус;
 *   • стол поставщика: КУ + способ доставки + статус (поставщик — он сам).
 * Статус включён в ключ, чтобы группа была однородной по стадии — действие на
 * карточке (подписать / ждать) однозначно.
 */

export interface GroupableReception {
  id: string;
  braname: string;
  offerer_account: string;
  offerer_name?: string | null;
  variant: string;
  status: string;
  ttn_number?: string | null;
  total_amount: string;
  created_at?: string | null;
  supplier_signed_at?: string | null;
  fact_quantity_per_order: ReadonlyArray<{
    product_name?: string | null;
    fact_quantity: number | string;
    unit_of_measure?: string | null;
    order_unit_size?: string | null;
    fact_unit_price?: string | null;
  }>;
}

// Строка сводной поставки, агрегированная по товару (несколько актов одного
// товара — одна строка с суммарным количеством и суммой).
export interface ReceptionGroupLine {
  key: string;
  productName: string;
  unit: string;
  orderUnitSize: string | null;
  quantity: number;
  amount: number;
}

export interface ReceptionGroup<T extends GroupableReception = GroupableReception> {
  key: string;
  offererAccount: string;
  offererName: string;
  braname: string;
  variant: string;
  status: string;
  ttnNumbers: string[];
  receptions: T[];
  lines: ReceptionGroupLine[];
  totalAmount: string;
  // Метки времени сводной поставки (для различения карточек по датам):
  //   createdAt — когда акт(ы) приёмки сформированы (поставка принята на ПВЗ);
  //   supplierSignedAt — когда поставщик подписал (если уже подписал).
  createdAt: string | null;
  supplierSignedAt: string | null;
}

export function groupAplReceptions<T extends GroupableReception>(
  receptions: readonly T[],
  opts: { byOfferer: boolean },
): ReceptionGroup<T>[] {
  const map = new Map<string, ReceptionGroup<T>>();
  for (const r of receptions) {
    const key = opts.byOfferer
      ? `${r.offerer_account}|${r.braname}|${r.variant}|${r.status}`
      : `${r.braname}|${r.variant}|${r.status}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        offererAccount: r.offerer_account,
        offererName: r.offerer_name || r.offerer_account,
        braname: r.braname,
        variant: r.variant,
        status: r.status,
        ttnNumbers: [],
        receptions: [],
        lines: [],
        totalAmount: '0',
        createdAt: null,
        supplierSignedAt: null,
      };
      map.set(key, g);
    }
    g.receptions.push(r);
    if (r.ttn_number && !g.ttnNumbers.includes(r.ttn_number)) g.ttnNumbers.push(r.ttn_number);
    // Поставка принята = самый ранний акт; поставщик подписал = самая поздняя
    // подпись по группе (вся поставка считается подписанной по последней).
    if (r.created_at && (!g.createdAt || r.created_at < g.createdAt)) g.createdAt = r.created_at;
    if (r.supplier_signed_at && (!g.supplierSignedAt || r.supplier_signed_at > g.supplierSignedAt))
      g.supplierSignedAt = r.supplier_signed_at;
  }
  // Агрегация строк по товару + сумма — после сбора всех receptions группы.
  for (const g of map.values()) {
    const lineMap = new Map<string, ReceptionGroupLine>();
    let total = 0;
    for (const r of g.receptions) {
      total += Number.parseFloat(r.total_amount) || 0;
      for (const f of r.fact_quantity_per_order) {
        const lk = `${f.product_name ?? ''}|${f.unit_of_measure ?? ''}`;
        const qty = Number(f.fact_quantity) || 0;
        const price = Number.parseFloat(f.fact_unit_price ?? '0') || 0;
        const ex = lineMap.get(lk);
        if (ex) {
          ex.quantity += qty;
          ex.amount += qty * price;
        } else {
          lineMap.set(lk, {
            key: lk,
            productName: f.product_name || 'Товар по предложению',
            unit: f.unit_of_measure ?? '',
            orderUnitSize: f.order_unit_size ?? null,
            quantity: qty,
            amount: qty * price,
          });
        }
      }
    }
    g.lines = [...lineMap.values()];
    g.totalAmount = total.toFixed(4);
  }
  return [...map.values()];
}
