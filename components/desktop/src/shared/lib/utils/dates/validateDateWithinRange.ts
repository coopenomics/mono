import moment from './moment';
import { t } from 'src/shared/i18n';

export function validateDateWithinRange(yearsAgo, yearsAhead = 0) {
  return (val) => {
    const inputDate = moment(val, 'YYYY/MM/DD HH:mm', true); // указание формата для парсинга
    const lowerLimit = moment().subtract(Math.abs(yearsAgo), 'years'); // Предел в прошлом
    const upperLimit = moment().add(Math.abs(yearsAhead), 'years'); // Предел в будущем

    if (!inputDate.isValid()) {
      return t('validation.date.invalidFormat');
    }

    if (inputDate.isBefore(lowerLimit)) {
      return t('validation.date.tooEarly', { date: lowerLimit.format('YYYY/MM/DD HH:mm') });
    }

    if (inputDate.isAfter(upperLimit)) {
      return t('validation.date.tooLate', { date: upperLimit.format('YYYY/MM/DD HH:mm') });
    }

    return true;
  };
}
