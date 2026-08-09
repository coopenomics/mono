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
 * Сборка `PaginationResult<U>` для consumer'ов, читающих через порт innercoop
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
 * Расчёт параметров пагинации для репозиториев, считающих выборку сами
 * (TypeORM `findAndCount` и прямой SQL).
 *
 * Типизирован на `PaginationInputDTO`, но принимает любой объект той же формы:
 * связь структурная, номинального `implements` между пакетом и ядром нет.
 */
export class PaginationUtils {
  /** Собрать результат из выборки репозитория и параметров запроса. */
  static createPaginationResult<T>(
    items: T[],
    totalCount: number,
    options: PaginationInputDTO
  ): PaginationResult<T> {
    const { page = 1, limit = 10 } = options;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      totalCount,
      totalPages,
      currentPage: page,
    };
  }

  /** Перевести номер страницы в `LIMIT`/`OFFSET`. */
  static getSqlPaginationParams(options: PaginationInputDTO): { limit: number; offset: number } {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    return {
      limit,
      offset,
    };
  }

  /**
   * Проверить параметры и подставить умолчания.
   *
   * Верхняя граница `limit` — защита от выгрузки всей таблицы одним запросом,
   * поэтому проверка живёт здесь, а не в каждом репозитории.
   */
  static validatePaginationOptions(options: PaginationInputDTO): PaginationInputDTO {
    const { page = 1, limit = 10, sortBy, sortOrder = 'ASC' } = options;

    if (page < 1) {
      throw new Error('Номер страницы должен быть больше 0');
    }

    if (limit < 1 || limit > 1000) {
      throw new Error('Количество элементов на странице должно быть от 1 до 1000');
    }

    if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
      throw new Error('Направление сортировки должно быть ASC или DESC');
    }

    return {
      page,
      limit,
      sortBy,
      sortOrder,
    };
  }
}

/**
 * Канон-конверсия `PaginationInputDTO` → `{limit, offset, sortBy, sortOrder}`
 * для адаптеров портов innercoop / внешних read API, не принимающих page-form.
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
