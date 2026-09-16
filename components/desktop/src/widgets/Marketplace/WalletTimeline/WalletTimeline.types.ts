// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export type WalletEntryKind = 'deposit' | 'block' | 'unblock' | 'charge' | 'refund' | 'payout'

export interface WalletEntry {
  id: string | number
  at: string | Date
  kind: WalletEntryKind
  amount: number
  title: string
  note?: string
  orderId?: string | number
}
