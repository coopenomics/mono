import type { ValueTransformer } from 'typeorm';

/**
 * TypeORM-трансформер для дробных количественных колонок (`numeric`): в БД
 * numeric читается как строка — возвращаем `number`, чтобы сущность и
 * арифметика работали с числом (как было с `integer` до Эпика 17). Дробное
 * количество (0.5 кг) требует numeric вместо integer; строковое представление
 * здесь не нужно (в отличие от денежных колонок, которые остаются строкой).
 */
export const numericQuantityTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null | undefined =>
    value === null || value === undefined ? value : Number(value),
};
