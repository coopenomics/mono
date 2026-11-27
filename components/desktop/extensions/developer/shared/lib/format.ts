/** Общий формат даты стола: `27.11.2026`; пустое и нечитаемое значение — прочерк. */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

/** Сумма в рублях без знака валюты: `1 499,5`. */
export function formatRub(rub: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(rub);
}
