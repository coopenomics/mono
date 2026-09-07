// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export type TakeoverKind = 'info' | 'success' | 'warning' | 'danger'
