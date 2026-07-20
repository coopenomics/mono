import { Field, Int, ObjectType, InputType } from '@nestjs/graphql';

/**
 * Входные параметры для пагинации и сортировки
 */
@InputType('PaginationInput')
export class PaginationInputDTO {
  @Field(() => Int, { description: 'Номер страницы', defaultValue: 1 })
  page!: number;

  @Field(() => Int, { description: 'Количество элементов на странице', defaultValue: 10 })
  limit!: number;

  @Field(() => String, { nullable: true, description: 'Ключ сортировки (например, "name")' })
  sortBy?: string;

  @Field(() => String, {
    description: 'Направление сортировки ("ASC" или "DESC")',
    defaultValue: 'ASC',
  })
  sortOrder!: 'ASC' | 'DESC';
}

/**
 * Результат пагинации (универсальный для TypeScript)
 */
export class PaginationResult<T> {
  items!: T[];
  totalCount!: number;
  totalPages!: number;
  currentPage!: number;
}

/**
 * Создание объекта GraphQL для результата пагинации
 * @param name - Имя объекта GraphQL
 * @param ItemType - Класс элемента списка
 */
export function createPaginationResult<T>(ItemType: new (...args: any[]) => T, name: string) {
  @ObjectType(`${name}PaginationResult`, { isAbstract: true })
  abstract class PaginationResult {
    @Field(() => [ItemType], { description: 'Элементы текущей страницы' })
    items!: T[];

    @Field(() => Int, { description: 'Общее количество элементов' })
    totalCount!: number;

    @Field(() => Int, { description: 'Общее количество страниц' })
    totalPages!: number;

    @Field(() => Int, { description: 'Текущая страница' })
    currentPage!: number;
  }
  return PaginationResult;
}

/**
 * Сборка `PaginationResult<U>` для consumer'ов, читающих через inter-порт
 * (нет своего Repository.findAndCount, доступен только raw `{items, totalCount}`).
 *
 * Зачем: вычисление `totalPages`/`currentPage` из `PaginationInputDTO` — общая
 * детерминированная логика; дублировать её в каждом consumer'е = canon-долг.
 */
export function buildPaginationResult<T, U>(
  raw: { items: T[]; totalCount: number },
  options: PaginationInputDTO | undefined,
  mapItem: (it: T) => U,
): PaginationResult<U> {
  const limit = options?.limit;
  const page = options?.page != null ? Math.max(1, options.page) : 1;
  const totalPages = limit != null && limit > 0 ? Math.max(1, Math.ceil(raw.totalCount / limit)) : 1;
  return {
    items: raw.items.map(mapItem),
    totalCount: raw.totalCount,
    totalPages,
    currentPage: page,
  };
}

/**
 * Канон-конверсия `PaginationInputDTO` → `{limit, offset, sortBy, sortOrder}`
 * для адаптеров inter-портов / внешних read API, не принимающих page-form.
 */
export function paginationInputToOffset(options?: PaginationInputDTO): {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
} {
  const limit = options?.limit;
  const page = options?.page != null ? Math.max(1, options.page) : 1;
  const offset = limit != null ? (page - 1) * limit : undefined;
  return {
    limit,
    offset,
    sortBy: options?.sortBy,
    sortOrder: options?.sortOrder,
  };
}
