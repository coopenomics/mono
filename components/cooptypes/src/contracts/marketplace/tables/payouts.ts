import type * as Marketplace from '../../../interfaces/marketplace'
import { Actors } from '../../../common'

/**
 * Имя таблицы.
 */
export const tableName = 'payouts'

/**
 * Таблица хранится в {@link Actors._coopname | области памяти кооператива}.
 */
export const scope = Actors._coopname

/**
 * @interface
 * Пакет выплаты поставщику (решение владельца 19.11.2026): один исходящий
 * платёж кассиру на принятые и ещё не оплаченные заказы поставщика за день.
 * Состояния open → sent → paid | declined; строка стирается, когда в пакете не
 * остаётся заказов. Индексы: byhash (2), byofferer (3).
 */
export type IPayout = Marketplace.IPayout

/** Состояния пакета выплаты. */
export const Statuses = {
  OPEN: 'open',
  SENT: 'sent',
  PAID: 'paid',
  DECLINED: 'declined',
} as const
