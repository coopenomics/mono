/**
 * Дата решения совета для строки утверждения в цепи.
 *
 * Фабрика документов пишет `meta.created_at` в виде `ДД.ММ.ГГГГ ЧЧ:ММ`, а
 * контракт ждёт `time_point_sec` без часового пояса (`ГГГГ-ММ-ДДTЧЧ:ММ:СС`).
 * Непонятную дату не выдумываем: возвращаем `null`, вызывающий подставит
 * момент обработки.
 */
export function toChainTimePoint(decisionDate: string | undefined | null): string | null {
  if (!decisionDate) return null;

  const ru = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(decisionDate.trim());
  if (ru) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = ru;
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  }

  const parsed = new Date(decisionDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19);
}

/** Момент «сейчас» в формате контракта. */
export function nowChainTimePoint(): string {
  return new Date().toISOString().slice(0, 19);
}
