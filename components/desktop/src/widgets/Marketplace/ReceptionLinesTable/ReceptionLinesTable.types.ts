// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export interface ReceptionLineRow {
  product_name: string | null;
  /** Количество в базовой единице; к показу приводится к единицам отпуска. */
  fact_quantity: number;
  unit_of_measure: string | null;
  /** Цена за единицу отпуска: за упаковку при `package_size` > 0. */
  fact_unit_price: string | null;
  /** Содержимое упаковки; null/0 — отпуск по мере. */
  package_size?: number | null;
}
