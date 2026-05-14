import { ReportType } from '../enums/report-type.enum';

/**
 * Реестр дат сдачи отчётов ФНС/СФР на 2026 год.
 *
 * Источники:
 * - ФНС (6-НДФЛ): ФЗ №540-ФЗ от 27.11.2023, сроки п.2 ст.230 НК РФ с 2024 г.
 * - РСВ: ст.431 НК РФ — до 25-го числа месяца следующего за отчётным периодом.
 * - ПСВ: ст.431 НК РФ — до 25-го числа каждого месяца, кроме последнего
 *   месяца каждого квартала (т.к. за эти месяцы РСВ).
 * - БУХОТЧ: ст.18 402-ФЗ — не позднее 3 месяцев после окончания года.
 * - ЕФС-1 ОСС: приказ СФР №1462 от 17.11.2025 — ежеквартально до 25-го.
 *
 * `shiftToBusinessDay` переносит выходные И праздничные дни РФ на
 * ближайший рабочий день. Источник праздников — RU_HOLIDAYS_BY_YEAR
 * (2026–2027 захардкожены; для более ранних/поздних лет срабатывает
 * только Sat/Sun-перенос — это графически безопасно, но формально
 * не отражает регламентные переносы).
 */

export type PeriodKind = 'yearly' | 'quarterly' | 'monthly';

export interface CalendarPeriodEntry {
  /** Код периода для генератора: 1..4 для quarterly, 1..12 для monthly, null для yearly. */
  periodCode: number | null;
  /** Человекочитаемая метка: «I кв.», «Январь», «Год». */
  label: string;
  /** Месяц сдачи (1..12). Год сдачи = reportYear или reportYear+1 (см. dueYearOffset). */
  dueMonth: number;
  /** День месяца сдачи (обычно 25, иногда 31/1/28). */
  dueDay: number;
  /** 0 = сдавать в том же году, 1 = в следующем. */
  dueYearOffset: 0 | 1;
}

export interface CalendarFormEntry {
  reportType: ReportType;
  /** Читаемое короткое имя для UI. */
  shortName: string;
  periodKind: PeriodKind;
  /** Список периодов года со сроками. Для yearly — массив из одного элемента. */
  periods: CalendarPeriodEntry[];
}

function quarterEntries(dueMonth: (q: 1 | 2 | 3 | 4) => number, dueDay = 25, yearOffset: (q: 1 | 2 | 3 | 4) => 0 | 1 = () => 0): CalendarPeriodEntry[] {
  return [1, 2, 3, 4].map((q) => {
    const quarter = q as 1 | 2 | 3 | 4;
    return {
      periodCode: q,
      label: quarter === 1 ? 'I кв.' : quarter === 2 ? 'Полугодие' : quarter === 3 ? '9 мес.' : 'Год',
      dueMonth: dueMonth(quarter),
      dueDay,
      dueYearOffset: yearOffset(quarter),
    };
  });
}

const RUSSIAN_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/**
 * ПСВ — ежемесячная форма: 12 записей, по одной на каждый месяц года.
 * Срок сдачи — до 25-го числа месяца, следующего за отчётным (ст.431 НК РФ).
 * Для декабря срок сдачи уходит на 25 января следующего года (dueYearOffset=1).
 *
 * Замечание: по приказу ФНС № ЕД-7-11/878@ за последние месяцы квартала
 * (м3/м6/м9/м12) ПСВ можно не сдавать, т.к. данные закрываются РСВ —
 * но это опциональное послабление, не отсутствие формы. На календаре
 * показываем все 12 ячеек; если пользователь решит, что март/июнь/сент/дек
 * закроются через РСВ, он отметит эти ячейки «Не надо сдавать».
 */
function psvEntries(): CalendarPeriodEntry[] {
  return Array.from({ length: 12 }, (_, i) => {
    const reportMonth = i + 1;
    const nextMonth = reportMonth + 1;
    const dueMonth = nextMonth > 12 ? 1 : nextMonth;
    const dueYearOffset: 0 | 1 = nextMonth > 12 ? 1 : 0;
    return {
      periodCode: reportMonth,
      label: RUSSIAN_MONTHS[reportMonth - 1] ?? String(reportMonth),
      dueMonth,
      dueDay: 25,
      dueYearOffset,
    };
  });
}

export const REPORTS_CALENDAR_REGISTRY: CalendarFormEntry[] = [
  {
    reportType: ReportType.BUHOTCH,
    shortName: 'Бухотчётность',
    periodKind: 'yearly',
    periods: [
      {
        periodCode: null,
        label: 'Год',
        dueMonth: 3,
        dueDay: 31,
        dueYearOffset: 1, // за 2026 год → сдача 31.03.2027
      },
    ],
  },
  {
    reportType: ReportType.NDFL6,
    shortName: '6-НДФЛ',
    periodKind: 'quarterly',
    periods: quarterEntries(
      (q) => (q === 1 ? 4 : q === 2 ? 7 : q === 3 ? 10 : 2),
      25,
      (q) => (q === 4 ? 1 : 0),
    ),
  },
  {
    reportType: ReportType.RSV,
    shortName: 'РСВ',
    periodKind: 'quarterly',
    periods: quarterEntries(
      (q) => (q === 1 ? 4 : q === 2 ? 7 : q === 3 ? 10 : 1),
      25,
      (q) => (q === 4 ? 1 : 0),
    ),
  },
  {
    reportType: ReportType.PSV,
    shortName: 'ПСВ',
    periodKind: 'monthly',
    periods: psvEntries(),
  },
  {
    reportType: ReportType.FSS4,
    shortName: 'ЕФС-1',
    periodKind: 'quarterly',
    periods: quarterEntries(
      (q) => (q === 1 ? 4 : q === 2 ? 7 : q === 3 ? 10 : 1),
      25,
      (q) => (q === 4 ? 1 : 0),
    ),
  },
];

/**
 * Производственный календарь РФ — множество праздничных дат в формате 'MM-DD'.
 * Набор — по 875-ФЗ / постановлениям Правительства о переносе выходных.
 *
 * Базовые нерабочие дни (одинаковые для всех лет):
 *   1-8 января (новогодние + Рождество), 23 февраля, 8 марта,
 *   1 и 9 мая, 12 июня, 4 ноября.
 *
 * Захардкожен 2026–2029 гг. Для годов вне таблицы применяется только
 * Sat/Sun-перенос. Добавочные выходные от переносов (напр. 3 мая из-за
 * 1 мая в пятницу) не моделируем — они не влияют на 25-е числа сдачи.
 */
const BASE_RU_HOLIDAYS = [
  '01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08',
  '02-23',
  '03-08',
  '05-01', '05-09',
  '06-12',
  '11-04',
] as const;

const RU_HOLIDAYS_BY_YEAR: Record<number, Set<string>> = {
  2026: new Set(BASE_RU_HOLIDAYS),
  2027: new Set(BASE_RU_HOLIDAYS),
  2028: new Set(BASE_RU_HOLIDAYS),
  2029: new Set(BASE_RU_HOLIDAYS),
};

function isNonBusinessDay(year: number, month1to12: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month1to12 - 1, day));
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return true;
  const holidays = RU_HOLIDAYS_BY_YEAR[year];
  if (!holidays) return false;
  const key = `${String(month1to12).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return holidays.has(key);
}

/**
 * Перенос даты на ближайший рабочий день: пропускаем Sat/Sun + праздничные
 * дни РФ (для известных лет). Защита от бесконечного цикла — max 14 итераций
 * (самый длинный подряд-выходной в РФ — 1-8 января = 8 дней + возможные
 * субботы/воскресенья после = до 10-12 подряд; 14 с запасом).
 */
function shiftToBusinessDay(year: number, month1to12: number, day: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month1to12 - 1, day));
  for (let i = 0; i < 14; i++) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    if (!isNonBusinessDay(y, m, dd)) {
      return { year: y, month: m, day: dd };
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  // Защита: если за 14 дней не нашли рабочий — возвращаем исходную дату
  // (лучше показать правильный вид, чем падать).
  return { year, month: month1to12, day };
}

/**
 * Собрать ISO-дату (YYYY-MM-DD) из reportYear + entry с переносом на рабочий день.
 * reportYear здесь — год, ЗА который отчитываются. dueYearOffset сдвигает на +1
 * если срок в следующем году.
 */
export function calcDueDate(reportYear: number, entry: CalendarPeriodEntry): string {
  const rawYear = reportYear + entry.dueYearOffset;
  const { year, month, day } = shiftToBusinessDay(rawYear, entry.dueMonth, entry.dueDay);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}
