/**
 * Дата решения совета для строки утверждения в цепи.
 *
 * Фабрика документов пишет `meta.created_at` в виде `ДД.ММ.ГГГГ ЧЧ:ММ`, а
 * контракт ждёт `time_point_sec` без часового пояса (`ГГГГ-ММ-ДДTЧЧ:ММ:СС`).
 * Непонятную дату не выдумываем: возвращаем `null`, вызывающий подставит
 * момент обработки.
 */
const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function toChainTimePoint(decisionDate: string | undefined | null): string | null {
  if (!decisionDate) return null;

  const ru = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(decisionDate.trim());
  if (ru) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = ru;
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  }

  // «10 апреля 2024 г.» — так реквизиты протокола записаны в настройках
  // кооперативов, заведённых до фабрики.
  const long = /^(\d{1,2})\s+(\p{Script=Cyrillic}+)\s+(\d{4})/iu.exec(decisionDate.trim());
  if (long) {
    const month = RU_MONTHS.indexOf(long[2]!.toLowerCase());
    if (month >= 0) {
      return `${long[3]}-${String(month + 1).padStart(2, '0')}-${long[1]!.padStart(2, '0')}T00:00:00`;
    }
  }

  const parsed = new Date(decisionDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19);
}

/** Момент «сейчас» в формате контракта. */
export function nowChainTimePoint(): string {
  return new Date().toISOString().slice(0, 19);
}
