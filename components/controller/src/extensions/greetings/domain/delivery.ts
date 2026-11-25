import { InnerNotifyDeliveryState } from '@coopenomics/innercoop';
import { GreetingDeliveryChannel, GreetingDeliveryState } from './greetings.enums';

/** Строка очереди уведомлений глазами приложения. */
export interface DeliveryRow {
  outboxId: string;
  channel: string;
  state: InnerNotifyDeliveryState;
}

const STATE: Record<InnerNotifyDeliveryState, GreetingDeliveryState> = {
  [InnerNotifyDeliveryState.PENDING]: GreetingDeliveryState.PENDING,
  [InnerNotifyDeliveryState.SENDING]: GreetingDeliveryState.PENDING,
  [InnerNotifyDeliveryState.SENT]: GreetingDeliveryState.DELIVERED,
  [InnerNotifyDeliveryState.FAILED]: GreetingDeliveryState.FAILED,
  [InnerNotifyDeliveryState.CANCELED]: GreetingDeliveryState.FAILED,
};

/**
 * Доставка письма по строкам очереди его каналов. Главное — почта: письмо
 * рассылки читают в ящике. Без почтовой строки берётся уведомление в
 * интерфейсе. Строк нет — доставка неизвестна (записи журнала до 25.11.2026).
 */
export function deliveryOf(outboxIds: readonly string[], rows: ReadonlyMap<string, DeliveryRow>): GreetingDeliveryState | null {
  const own = outboxIds.map((id) => rows.get(id)).filter((row): row is DeliveryRow => Boolean(row));
  const main =
    own.find((row) => row.channel === GreetingDeliveryChannel.EMAIL) ??
    own.find((row) => row.channel === GreetingDeliveryChannel.IN_APP) ??
    own[0];
  return main ? (STATE[main.state] ?? null) : null;
}
