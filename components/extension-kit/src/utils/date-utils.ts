import moment from 'moment-timezone';
import { platformSettings } from '../config/platform-settings';

// Устанавливаем локаль moment на русский для корректного humanize
import 'moment/locale/ru';

/**
 * Утилита для работы с датами с учетом часового пояса
 * Реализована на базе библиотеки moment-timezone
 */
export class DateUtils {
  /**
   * Преобразует UTC дату в локальную дату согласно временной зоне из конфигурации
   */
  static convertUtcToLocalTime(date: Date | string): Date {
    return moment.utc(date).tz(platformSettings().timezone).toDate();
  }

  /**
   * Форматирует дату в локальном формате с учетом временной зоны
   */
  static formatLocalDate(date: Date | string, format = 'DD.MM.YYYY'): string {
    return moment.utc(date).tz(platformSettings().timezone).format(format);
  }

  /**
   * Форматирует время в локальном формате с учетом временной зоны
   */
  static formatLocalTime(date: Date | string, format = 'HH:mm'): string {
    return moment.utc(date).tz(platformSettings().timezone).format(format);
  }

  /**
   * Форматирует дату в локальном формате (дд.мм.гггг)
   */
  static formatLocalDateWithoutTimezone(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /**
   * Форматирует время в локальном формате (чч:мм)
   */
  static formatLocalTimeWithoutTimezone(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Определяет, наступило ли уже указанное время с учетом временной зоны
   */
  static isTimeReached(targetDate: Date | string): boolean {
    const now = moment();
    const target = moment.utc(targetDate).tz(platformSettings().timezone);
    return now.isAfter(target) || now.isSame(target);
  }

  /**
   * Вычисляет дату за указанное количество дней до целевой даты
   */
  static getDaysBeforeDate(targetDate: Date | string, days: number): Date {
    return moment.utc(targetDate).tz(platformSettings().timezone).subtract(days, 'days').toDate();
  }

  /**
   * Форматирует разницу во времени в человекочитаемый вид на русском языке (например, 'через 3 дня')
   */
  static formatDurationHumanizeRu(minutes: number): string {
    moment.locale('ru');
    // humanize(true) -> 'через ...'
    return moment.duration({ minutes }).humanize(true);
  }
}
