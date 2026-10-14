import { assetMinor, assetOf, slotLessonCost, type EduScheduleSlot } from './schedule';

/** Сведения для показа суммы взноса за занятие: окно, длительность, ставка допуска, порядок расчёта, обучающиеся. */
export interface LessonChargeInput {
  slot: Pick<EduScheduleSlot, 'minutes' | 'hourly_rate'> | null | undefined;
  minutes: number;
  /** Ставка часа преподавателя в допуске («1000.0000 RUB»). */
  rate: string | null | undefined;
  /** Расчёт за каждого участника; иначе сумма занятия одна на группу. */
  perLearner: boolean;
  /** Обучающихся с оплаченным доступом на дату занятия. */
  learners: number;
}

const ASSET = /^\d+\.\d{4} [A-Z]{1,7}$/;

/** Стоимость занятия для участника — как `slot_cost` контракта: стоимость окна, у иной длительности — пропорционально, с отсечением. */
function unitMinor(slot: LessonChargeInput['slot'], minutes: number): number | null {
  const cost = slot ? slotLessonCost(slot) : '';
  if (!cost) return null;
  const slotMinutes = Number(slot?.minutes || 0);
  const minor = assetMinor(cost);
  return slotMinutes === 0 || slotMinutes === minutes ? minor : Math.trunc((minor * minutes) / slotMinutes);
}

/**
 * Показ суммы взноса преподавателя за занятие до отчёта — та же арифметика,
 * что у контракта: при открытии занятия взнос равен ставке допуска за минуты
 * (с отсечением), но не больше стоимости занятия для участника; при расчёте —
 * за каждого обучающегося с оплаченным доступом либо одна сумма на занятие, не
 * больше оплаты всех обучающихся. Это показ: окончательную сумму считает и
 * записывает контракт. Посчитать нечем (нет ставки, окна, обучающихся) — `null`.
 */
export function expectedLessonAmount(input: LessonChargeInput): string | null {
  const rate = String(input.rate ?? '').trim();
  const unit = unitMinor(input.slot, input.minutes);
  if (!ASSET.test(rate) || unit === null || input.learners <= 0) return null;
  const symbol = rate.split(' ')[1];
  const charge = Math.min(Math.trunc((assetMinor(rate) * input.minutes) / 60), unit);
  const total = input.perLearner ? charge * input.learners : Math.min(charge, unit * input.learners);
  return assetOf(total, symbol);
}
