// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

/** Реквизиты накладной партии — заполняются только у доставки экспедитором. */
export interface ShipmentDetailsTtn {
  expeditor_full_name?: string | null
  expeditor_phone?: string | null
  vehicle_number?: string | null
  loading_address?: string | null
  loading_datetime?: unknown
  delivery_datetime_estimate?: unknown
}

/**
 * Партия отгрузки — то, что о ней показывает панель. Тип структурный: вью из
 * SDK подходит как есть, а виджет не тянет за собой слой страницы.
 */
export interface ShipmentDetailsSummary {
  id: string
  cycle_id?: string | null
  total_amount: string
  ttn_number?: string | null
  ttn_data?: ShipmentDetailsTtn | null
  created_at?: unknown
}

/** Строка состава партии — заказ поставщика. */
export interface ShipmentDetailsOrderLine {
  id: string
  shipment_id?: string | null
  product_name?: string | null
  orderer_name?: string | null
  orderer_account: string
  quantity: number
  unit_of_measure?: string | null
  package_size?: number | null
  total_cost: string
}
