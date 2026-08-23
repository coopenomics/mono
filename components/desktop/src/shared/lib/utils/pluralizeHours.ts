/**
 * Общая функция для склонения русских слов по количеству
 * @param count - количество
 * @param titles - массив форм слова [единственное, двойственное, множественное]
 * @returns правильно склоненное слово
 */
export const pluralize = (count: number, titles: [string, string, string]): string => {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[(count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)]];
};

/**
 * Склонение слова "час" в зависимости от количества
 * @param count - количество часов
 * @returns правильно склоненное слово
 */
export const pluralizeHours = (count: number): string => {
  return pluralize(count, ['час', 'часа', 'часов']);
};

/**
 * Склонение слова "минута" в зависимости от количества
 */
export const pluralizeMinutes = (count: number): string => {
  return pluralize(count, ['минута', 'минуты', 'минут']);
};

/**
 * Склонение слова "день" в зависимости от количества
 * @param count - количество дней
 * @returns правильно склоненное слово
 */
export const pluralizeDays = (count: number): string => {
  return pluralize(count, ['день', 'дня', 'дней']);
};

/**
 * Склонение слова "аккаунт" в зависимости от количества
 * @param count - количество аккаунтов
 * @returns правильно склоненное слово
 */
export const pluralizeAccounts = (count: number): string => {
  return pluralize(count, ['аккаунт', 'аккаунта', 'аккаунтов']);
};

/**
 * Форматирование длительности: меньше часа — в минутах, иначе в часах.
 * @param hours - количество часов (дробные допустимы)
 * @returns строка вида "12 минут", "1 час", "1.5 час"
 */
export const formatHours = (hours: number): string => {
  if (!Number.isFinite(hours) || hours <= 0) {
    return `0 ${pluralizeHours(0)}`;
  }

  // Меньше часа — минуты (1 мин таймера иначе схлопывалась в «0 часов» после toFixed(1))
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} ${pluralizeMinutes(minutes)}`;
  }

  // Форматируем дробные числа до 1 знака после запятой
  const formattedHours = hours % 1 === 0 ? hours : parseFloat(hours.toFixed(1));

  // Для дробных чисел используем единственное число "час"
  if (formattedHours % 1 !== 0) {
    return `${formattedHours} час`;
  }

  // Для целых чисел используем обычное склонение
  return `${formattedHours} ${pluralizeHours(formattedHours)}`;
};
