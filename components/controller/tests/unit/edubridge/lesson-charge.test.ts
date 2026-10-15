import { expectedLessonAmount } from '~/extensions/edubridge/domain/lib/lesson-charge';

/**
 * Показ суммы взноса за занятие до отчёта повторяет арифметику контракта:
 * openlesson — ставка допуска за минуты с отсечением, не больше стоимости
 * занятия по окну; chargelesson — за каждого участника либо одна сумма на
 * занятие, не больше оплаты всех участников.
 */
const slot = { minutes: 60, hourly_rate: '1000.0000 RUB' };

describe('показ суммы взноса за занятие', () => {
  it('расчёт за каждого участника: ставка допуска за минуты на число обучающихся', () => {
    expect(expectedLessonAmount({ slot, minutes: 60, rate: '750.0000 RUB', perLearner: true, learners: 2 })).toBe('1500.0000 RUB');
  });

  it('ставка допуска выше стоимости занятия — взнос не больше стоимости занятия', () => {
    expect(expectedLessonAmount({ slot, minutes: 60, rate: '1200.0000 RUB', perLearner: true, learners: 1 })).toBe('1000.0000 RUB');
  });

  it('занятие короче окна — стоимость занятия пропорционально минутам, ставка за минуты с отсечением', () => {
    expect(expectedLessonAmount({ slot, minutes: 45, rate: '1000.0000 RUB', perLearner: true, learners: 1 })).toBe('750.0000 RUB');
    expect(expectedLessonAmount({ slot: { minutes: 45, hourly_rate: '1000.0000 RUB' }, minutes: 7, rate: '333.3333 RUB', perLearner: true, learners: 1 })).toBe('38.8888 RUB');
  });

  it('фиксированный расчёт: одна сумма на занятие, не больше оплаты всех обучающихся', () => {
    expect(expectedLessonAmount({ slot: { minutes: 60, hourly_rate: '300.0000 RUB' }, minutes: 60, rate: '1000.0000 RUB', perLearner: false, learners: 2 })).toBe('300.0000 RUB');
    expect(expectedLessonAmount({ slot, minutes: 60, rate: '900.0000 RUB', perLearner: false, learners: 3 })).toBe('900.0000 RUB');
  });

  it('посчитать нечем — пусто: нет обучающихся, ставки или стоимости окна', () => {
    expect(expectedLessonAmount({ slot, minutes: 60, rate: '750.0000 RUB', perLearner: true, learners: 0 })).toBeNull();
    expect(expectedLessonAmount({ slot, minutes: 60, rate: '', perLearner: true, learners: 1 })).toBeNull();
    expect(expectedLessonAmount({ slot: { minutes: 60, hourly_rate: '' }, minutes: 60, rate: '750.0000 RUB', perLearner: true, learners: 1 })).toBeNull();
    expect(expectedLessonAmount({ slot: null, minutes: 60, rate: '750.0000 RUB', perLearner: true, learners: 1 })).toBeNull();
  });
});
