// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export type ChannelKind = 'push' | 'email' | 'sms'

export type ChannelStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending' | 'disabled'

export interface ChannelStatusEntry {
  kind: ChannelKind
  status: ChannelStatus
  at?: string | Date
  error?: string
}
