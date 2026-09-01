import moment from './moment';

/**
 * Даты из анкеты пайщика приходят в разном виде — ISO от бэкенда и «1990/04/01»
 * от календаря Quasar, — поэтому разбираем по списку известных форматов:
 * moment без формата пишет в консоль депрекейшен на каждое значение.
 */
const DOCUMENT_DATE_FORMATS = ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD.MM.YYYY', moment.ISO_8601];

/**
 * Дата документа пайщика (рождение, выдача паспорта) в привычном виде
 * ДД.ММ.ГГГГ. Нераспознанное значение отдаём как есть — лучше показать сырую
 * строку, чем пустоту на экране сверки личности.
 */
export function formatDocumentDate(value?: string | null): string {
  if (!value) return '';
  const parsed = moment(String(value), DOCUMENT_DATE_FORMATS);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : String(value);
}
