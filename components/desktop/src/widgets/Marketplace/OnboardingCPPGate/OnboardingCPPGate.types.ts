// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export interface CPPDocument {
  id: string
  title: string
  description?: string
  url?: string
  required?: boolean
  locked?: boolean
}
