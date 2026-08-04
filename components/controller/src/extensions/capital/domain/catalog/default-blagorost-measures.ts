/**
 * Дефолтный справочник мер Благороста: название, единица, режим, волна, тег.
 * Волна — шаг анализа локальной 5/3, не «норма N за период».
 * Тег — для фильтра (личное / кооп / …).
 */
import { createHash } from 'crypto';
import { MeasureCatalogTag } from '../enums/measure-catalog-tag.enum';
import { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../enums/metric-series-period.enum';

export interface DefaultMeasureSeed {
  title: string;
  unit: string;
  series_mode: MetricSeriesMode;
  /** Шаг локальной волны (UI-лейбл «Волна») */
  wave_period: MetricSeriesPeriod;
  tag: MeasureCatalogTag;
}

/** Детерминированный хеш для сида — миграция и ensureDefaultMeasures совпадают. */
export function defaultMeasureHash(coopname: string, title: string, unit: string): string {
  return createHash('sha256')
    .update(`capital-measure:v1:${coopname}:${title}:${unit}`)
    .digest('hex');
}

const R = MetricSeriesMode.RATE;
const L = MetricSeriesMode.LEVEL;
const DAY = MetricSeriesPeriod.DAY;
const WEEK = MetricSeriesPeriod.WEEK;
const MONTH = MetricSeriesPeriod.MONTH;

export const DEFAULT_BLAGOROST_MEASURES: readonly DefaultMeasureSeed[] = [
  // personal
  { title: 'Подтягивания', unit: 'раз', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Отжимания', unit: 'раз', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Приседания', unit: 'раз', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Шаги', unit: 'шт.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Бег / ходьба', unit: 'км', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Тренировки', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Сон', unit: 'ч', series_mode: L, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Вес', unit: 'кг', series_mode: L, wave_period: WEEK, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Настроение', unit: 'балл', series_mode: L, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Энергия', unit: 'балл', series_mode: L, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Медитация', unit: 'мин', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },
  { title: 'Чтение', unit: 'стр.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.PERSONAL },

  // product
  { title: 'Новые пользователи', unit: 'чел.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },
  { title: 'Активные пользователи', unit: 'чел.', series_mode: L, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },
  { title: 'Регистрации', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },
  { title: 'Удержанные (вернулись)', unit: 'чел.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },
  { title: 'Конверсия в действие', unit: '%', series_mode: L, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },
  { title: 'Обращения', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },
  { title: 'Новые взносы', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },
  { title: 'Средний взнос', unit: '₽', series_mode: L, wave_period: WEEK, tag: MeasureCatalogTag.PRODUCT },

  // content
  { title: 'Посты', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.CONTENT },
  { title: 'Видео', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.CONTENT },
  { title: 'Рилсы', unit: 'шт.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.CONTENT },
  { title: 'Истории', unit: 'шт.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.CONTENT },
  { title: 'Подкасты', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.CONTENT },
  { title: 'Рассылки', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.CONTENT },
  { title: 'Просмотры', unit: 'шт.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.CONTENT },
  { title: 'Охват', unit: 'чел.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.CONTENT },
  { title: 'Лайки', unit: 'шт.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.CONTENT },
  { title: 'Комментарии', unit: 'шт.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.CONTENT },
  { title: 'Репосты', unit: 'шт.', series_mode: R, wave_period: DAY, tag: MeasureCatalogTag.CONTENT },
  { title: 'Подписчики', unit: 'чел.', series_mode: L, wave_period: WEEK, tag: MeasureCatalogTag.CONTENT },

  // cooperative
  { title: 'Новые пайщики', unit: 'чел.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.COOPERATIVE },
  { title: 'Активные пайщики', unit: 'чел.', series_mode: L, wave_period: WEEK, tag: MeasureCatalogTag.COOPERATIVE },
  { title: 'Предложения', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.COOPERATIVE },
  { title: 'Закрытые задачи', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.COOPERATIVE },

  // quality
  { title: 'Баги', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.QUALITY },
  { title: 'Инциденты', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.QUALITY },
  { title: 'Закрытые инциденты', unit: 'шт.', series_mode: R, wave_period: WEEK, tag: MeasureCatalogTag.QUALITY },
  { title: 'NPS', unit: 'балл', series_mode: L, wave_period: MONTH, tag: MeasureCatalogTag.QUALITY },
  { title: 'CSI', unit: 'балл', series_mode: L, wave_period: MONTH, tag: MeasureCatalogTag.QUALITY },
  { title: 'Время ответа', unit: 'ч', series_mode: L, wave_period: WEEK, tag: MeasureCatalogTag.QUALITY },
] as const;
