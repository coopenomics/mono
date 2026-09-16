// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export interface TTNItem {
  sku: string
  title: string
  qty: number
  unit: string
  price: number
  /** Штук имущества в одной коробке (экспедиторская упаковка партии). */
  unitsPerBox?: number
  /** Коробок в строке = ceil(qty / unitsPerBox). */
  boxes?: number
}

export interface TTNData {
  number: string
  date: string | Date
  /** Грузоотправитель — поставщик (орг-или-ФИО, не braname). */
  supplier: string
  /** Грузополучатель / ПВЗ — название КУ. */
  recipient: string
  /** Адрес КУ-получателя — «куда везти». */
  recipientAddress?: string
  /** Перевозчик: ФИО экспедитора (подписант ТТН). */
  expeditorName?: string
  /** Телефон экспедитора. */
  expeditorPhone?: string
  /** Госномер ТС. */
  vehicleNumber?: string
  /** Адрес погрузки (склад поставщика). */
  loadingAddress?: string
  /** Дата погрузки. */
  loadingDatetime?: string
  /** Расчётная дата доставки на КУ. */
  deliveryEstimate?: string
  items: TTNItem[]
  /** Оператор/председатель КУ — подпись приёмки (заполняется на месте, от руки). */
  acceptedBy?: string
  /**
   * Код приёмки партии (shipment-bound handoff-токен). Печатается на ТТН как QR:
   * оператор КУ сканирует его и принимает СТРОГО состав этой партии (экспедитор
   * не пайщик — приёмка по накладной, а не по аккаунту).
   */
  qrValue?: string
  /** Тот же код текстом — для ручного ввода оператором без камеры. */
  qrCode?: string
}
