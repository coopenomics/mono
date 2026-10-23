// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export interface WarehouseRow {
  key: string
  /** Предложение, по которому имущество попало на склад; null — предложение неизвестно. */
  offerId: string | null
  title: string // Позиция (наименование товара)
  categoryId: number | null // категория предложения — для фильтра по разделам каталога
  categoryName: string | null // название категории для показа
  pvzName: string | null // наименование КУ (наименование организации участка)
  pvzAddress: string | null // адрес КУ
  pvzBraname: string // служебное имя участка — fallback для поиска/показа
  unit: string // короткая подпись единицы измерения (шт/кг/л/упак)
  incoming: number // приход на КУ (всё оприходованное)
  issued: number // выдано пайщикам
  writtenOff: number // списано
  balance: number // остаток на КУ (приход − расход)
  /** Ближайший срок годности лежащего на складе, мс; null — срока нет. */
  expiryAt: number | null
  /** Количество единиц на складе без штрих-кода — что ещё предстоит промаркировать. */
  unlabeled: number
}
