// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export interface WarehouseRow {
  key: string
  title: string // Позиция (наименование товара)
  pvzName: string | null // наименование КУ (наименование организации участка)
  pvzAddress: string | null // адрес КУ
  pvzBraname: string // служебное имя участка — fallback для поиска/показа
  unit: string // короткая подпись единицы измерения (шт/кг/л/упак)
  incoming: number // приход на КУ (всё оприходованное)
  outgoing: number // расход (выдано пайщику + списано)
  balance: number // остаток на КУ (приход − расход)
}
