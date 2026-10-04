/**
 * Поле сортировки списков — закрытый набор колонок.
 *
 * Что здесь защищается. `sortBy` приходит от клиента в общем `PaginationInput`
 * и подставляется в `ORDER BY` строкой: TypeORM вставляет его в SQL как есть,
 * параметром его не передать. До 23.09.2026 журнал расширений
 * (`getExtensionLogs`) и решения председателя (`chairmanApprovals`) брали поле
 * без проверки, и любой член совета мог дописать в сортировку подзапрос и
 * посимвольно вычитать базу.
 *
 * Рубежей два: имя поля отсекается по шаблону ещё на входе (DTO и
 * `PaginationUtils`), а репозиторий пропускает только колонку своей сущности.
 *
 * Реестр случаев: test-registry/platform.list-sort-order-by.yaml
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationInputDTO, PaginationUtils } from '@coopenomics/extension-kit';
import { LOG_EXTENSION_SORT_COLUMNS } from '~/infrastructure/database/kysely/repositories/log-extension.kysely-repository';
import { sortColumn, sortDirection } from '~/infrastructure/database/kysely/sort';
import { ApprovalTypeormRepository } from '~/extensions/chairman/infrastructure/repositories/approval.typeorm-repository';

const INJECTION = 'created_at, (SELECT CASE WHEN (1=1) THEN pg_sleep(5) END)';

function makeQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['andWhere', 'where', 'orderBy', 'skip', 'take']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getMany = jest.fn().mockResolvedValue([]);
  return qb;
}

function makeOrmRepository(columns: string[]) {
  const qb = makeQueryBuilder();
  const repository = {
    metadata: { columns: columns.map((name) => ({ propertyName: name, databaseName: name })) },
    createQueryBuilder: jest.fn(() => qb),
  };
  return { repository, qb };
}

describe('Поле сортировки на входе', () => {
  it('простое имя колонки проходит проверку DTO', async () => {
    const dto = plainToInstance(PaginationInputDTO, { page: 1, limit: 10, sortBy: '_created_at', sortOrder: 'DESC' });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('дописанный SQL отклоняется проверкой DTO', async () => {
    const dto = plainToInstance(PaginationInputDTO, { page: 1, limit: 10, sortBy: INJECTION, sortOrder: 'DESC' });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('sortBy');
  });

  it('PaginationUtils отказывает в поле с посторонними символами', () => {
    expect(() =>
      PaginationUtils.validatePaginationOptions({ page: 1, limit: 10, sortBy: INJECTION, sortOrder: 'ASC' })
    ).toThrow('Недопустимое поле сортировки');
  });

  it('поле с направлением через двоеточие проходит — так сортирует реестр пайщиков', async () => {
    const dto = plainToInstance(PaginationInputDTO, { page: 1, limit: 10, sortBy: 'created_at:desc', sortOrder: 'DESC' });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(
      PaginationUtils.validatePaginationOptions({ page: 1, limit: 10, sortBy: 'joined_at:asc', sortOrder: 'ASC' }).sortBy
    ).toBe('joined_at:asc');
  });

  it('пустое поле — «без сортировки», как отдаёт таблица со снятой сортировкой', async () => {
    const dto = plainToInstance(PaginationInputDTO, { page: 1, limit: 10, sortBy: '', sortOrder: 'DESC' });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(PaginationUtils.validatePaginationOptions({ page: 1, limit: 10, sortBy: '', sortOrder: 'ASC' }).sortBy).toBe('');
  });

  it('после двоеточия — только направление, не SQL', () => {
    expect(() =>
      PaginationUtils.validatePaginationOptions({ page: 1, limit: 10, sortBy: 'created_at:desc, 1', sortOrder: 'ASC' })
    ).toThrow('Недопустимое поле сортировки');
    expect(() =>
      PaginationUtils.validatePaginationOptions({ page: 1, limit: 10, sortBy: 'created_at:(select 1)', sortOrder: 'ASC' })
    ).toThrow('Недопустимое поле сортировки');
  });

  it('PaginationUtils пропускает список без сортировки и с обычным полем', () => {
    expect(PaginationUtils.validatePaginationOptions({ page: 1, limit: 10, sortOrder: 'ASC' }).sortBy).toBeUndefined();
    expect(
      PaginationUtils.validatePaginationOptions({ page: 1, limit: 10, sortBy: 'created_at', sortOrder: 'ASC' }).sortBy
    ).toBe('created_at');
  });
});

describe('Журнал расширений (getExtensionLogs)', () => {
  // Хранилище на Kysely: имя колонки берётся только из своего перечня.
  it('сортирует по колонке журнала', () => {
    expect(sortColumn(LOG_EXTENSION_SORT_COLUMNS, 'name', 'created_at')).toBe('name');
    expect(sortDirection('ASC')).toBe('asc');
  });

  it('подзапрос в поле сортировки до SQL не доходит', () => {
    expect(sortColumn(LOG_EXTENSION_SORT_COLUMNS, INJECTION, 'created_at')).toBe('created_at');
    expect(sortColumn(LOG_EXTENSION_SORT_COLUMNS, undefined, 'created_at')).toBe('created_at');
  });

  it('направление сортировки — только ASC или DESC', () => {
    expect(sortDirection('DESC; DROP TABLE x')).toBe('desc');
    expect(sortDirection(undefined)).toBe('desc');
    expect(sortDirection('asc')).toBe('asc');
  });
});

describe('Решения председателя (chairmanApprovals)', () => {
  it('неизвестная колонка заменяется умолчанием', async () => {
    const { repository, qb } = makeOrmRepository(['id', 'status', 'created_at']);
    const approvals = new ApprovalTypeormRepository(repository as never, {} as never);
    await approvals.findAllPaginated(undefined, { page: 1, limit: 10, sortBy: 'password', sortOrder: 'ASC' });
    expect(qb.orderBy).toHaveBeenCalledWith('approval.created_at', 'ASC');
  });

  it('сортирует по колонке решения', async () => {
    const { repository, qb } = makeOrmRepository(['id', 'status', 'created_at']);
    const approvals = new ApprovalTypeormRepository(repository as never, {} as never);
    await approvals.findAllPaginated(undefined, { page: 1, limit: 10, sortBy: 'status', sortOrder: 'DESC' });
    expect(qb.orderBy).toHaveBeenCalledWith('approval.status', 'DESC');
  });

  it('подзапрос в поле сортировки отклоняется до построения запроса', async () => {
    const { repository, qb } = makeOrmRepository(['id', 'status', 'created_at']);
    const approvals = new ApprovalTypeormRepository(repository as never, {} as never);
    await expect(
      approvals.findAllPaginated(undefined, { page: 1, limit: 10, sortBy: INJECTION, sortOrder: 'ASC' })
    ).rejects.toThrow('Недопустимое поле сортировки');
    expect(qb.orderBy).not.toHaveBeenCalled();
  });
});
