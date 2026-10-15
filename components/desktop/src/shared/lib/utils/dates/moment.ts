import moment from 'moment-timezone';
import { t } from 'src/shared/i18n';

// Тексты локали — из словаря `datetime` (src/shared/i18n/locales/ru/datetime.json).
// Формы по числу выбирает переводчик: «1 день», «2 дня», «5 дней».
const PLURAL_UNITS: Record<string, string> = {
  ss: 'seconds',
  mm: 'minutes',
  hh: 'hours',
  dd: 'days',
  MM: 'months',
  yy: 'years',
};

// Одна единица без числа: «через час», «день назад».
const SINGLE_UNITS: Record<string, string> = { h: 'hour', d: 'day', M: 'month', y: 'year' };

function relativeTimeWithPlural(number: number, withoutSuffix: boolean, key: string): string {
  if (key === 'm') {
    return withoutSuffix ? t('datetime.relative.minute') : t('datetime.relative.minuteAccusative');
  }
  if (SINGLE_UNITS[key]) return t(`datetime.relative.${SINGLE_UNITS[key]}`);
  const unit = PLURAL_UNITS[key];
  return unit ? t(`datetime.relative.${unit}`, number) : '';
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const months = Array.from({ length: 12 }, (_, i) => t(`datetime.month.${pad2(i + 1)}`));
const monthsShort = Array.from({ length: 12 }, (_, i) => t(`datetime.monthShort.${pad2(i + 1)}`));
const weekdays = Array.from({ length: 7 }, (_, i) => t(`datetime.weekday.${i}`));
const weekdaysShort = Array.from({ length: 7 }, (_, i) => t(`datetime.weekdayShort.${i}`));
const at = t('datetime.calendar.timeAt');

// Добавляем русскую локализацию вручную
moment.updateLocale('ru', {
  months,
  monthsShort,
  weekdays,
  weekdaysShort,
  weekdaysMin: weekdaysShort,
  longDateFormat: {
    LT: 'HH:mm',
    LTS: 'HH:mm:ss',
    L: 'DD.MM.YYYY',
    LL: 'D MMMM YYYY',
    LLL: 'D MMMM YYYY HH:mm',
    LLLL: 'dddd, D MMMM YYYY HH:mm',
  },
  calendar: {
    sameDay: `[${t('datetime.calendar.sameDay')}] LT`,
    nextDay: `[${t('datetime.calendar.nextDay')}] LT`,
    nextWeek: `[${t('datetime.calendar.nextWeek')}] dddd [${at}] LT`,
    lastDay: `[${t('datetime.calendar.lastDay')}] LT`,
    lastWeek: `[${t('datetime.calendar.lastWeek')}] dddd [${at}] LT`,
    sameElse: 'L',
  },
  relativeTime: {
    future: t('datetime.relative.future', { time: '%s' }),
    past: t('datetime.relative.past', { time: '%s' }),
    s: t('datetime.relative.fewSeconds'),
    ss: relativeTimeWithPlural,
    m: relativeTimeWithPlural,
    mm: relativeTimeWithPlural,
    h: relativeTimeWithPlural,
    hh: relativeTimeWithPlural,
    d: relativeTimeWithPlural,
    dd: relativeTimeWithPlural,
    M: relativeTimeWithPlural,
    MM: relativeTimeWithPlural,
    y: relativeTimeWithPlural,
    yy: relativeTimeWithPlural,
  },
});

// Устанавливаем локаль по умолчанию
moment.locale('ru');

export default moment;
