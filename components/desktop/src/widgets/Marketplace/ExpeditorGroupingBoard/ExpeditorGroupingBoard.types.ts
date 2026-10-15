// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export interface GroupingItem {
  id: string | number
  shortId: string
  title: string
  units: number
  unitLabel?: string
  pvz: string
}

export interface GroupingColumn {
  id: string
  title: string
  meta?: string
  items: GroupingItem[]
}
