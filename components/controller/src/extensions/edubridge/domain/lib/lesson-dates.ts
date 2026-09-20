/**
 * Даты занятия для акта хранения и для цепи. Акт читает человек, поэтому в нём
 * дата и время по-русски; контракт принимает `time_point_sec` секундной
 * точности без часового пояса.
 */
export function formatDateTime(value: Date): string {
  return `${formatDate(value)} ${value.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatDate(value: Date): string {
  return value.toLocaleDateString('ru-RU');
}

export function toChainTimePoint(value: Date): string {
  return new Date(Math.floor(value.getTime() / 1000) * 1000).toISOString().slice(0, 19);
}
