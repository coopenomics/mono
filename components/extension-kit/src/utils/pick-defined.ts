/**
 * Заданные поля объекта: из перечисленных берутся только те, чьё значение не
 * `undefined`. Нужна там, где частичная правка не должна затирать поля, которых
 * вызывающий не передал.
 */
export function pickDefined<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const picked: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
}
