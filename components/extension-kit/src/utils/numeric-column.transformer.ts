import type { ValueTransformer } from 'typeorm';

/**
 * Трансформер колонок `numeric`, которые в домене — число: Postgres отдаёт
 * numeric строкой, а сущности и арифметика работают с `number`. Годится для
 * количеств (0.5 кг) и сумм, которые домен держит числом (сумма платежа);
 * денежные поля, которые домен держит строкой актива, его не используют.
 *
 * Один экземпляр на ядро и расширения — из пакета (из typeorm здесь только тип).
 */
export const numericColumnTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null | undefined =>
    value === null || value === undefined ? value : Number(value),
};
