import { GreetingDeliveryState } from './greetings.enums';

/** Строка очереди уведомлений глазами приложения. */
export interface DeliveryRow {
  outboxId: string;
  channel: string;
  state: string;
}

const STATE: Record<string, GreetingDeliveryState> = {
  pending: GreetingDeliveryState.PENDING,
  sending: GreetingDeliveryState.PENDING,
  sent: GreetingDeliveryState.DELIVERED,
  failed: GreetingDeliveryState.FAILED,
  canceled: GreetingDeliveryState.FAILED,
};

/**
 * Доставка письма по строкам очереди его каналов. Главное — почта: письмо
 * рассылки читают в ящике. Без почтовой строки берётся уведомление в
 * интерфейсе. Строк нет — доставка неизвестна (записи журнала до 25.11.2026).
 */
export function deliveryOf(outboxIds: readonly string[], rows: ReadonlyMap<string, DeliveryRow>): GreetingDeliveryState | null {
  const own = outboxIds.map((id) => rows.get(id)).filter((row): row is DeliveryRow => Boolean(row));
  const main = own.find((row) => row.channel === 'email') ?? own.find((row) => row.channel === 'in_app') ?? own[0];
  return main ? (STATE[main.state] ?? null) : null;
}
