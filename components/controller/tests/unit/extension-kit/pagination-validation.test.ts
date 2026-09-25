/**
 * Параметры списка — ввод клиента: неверные отклоняются отказом 400, а не
 * доходят до ORDER BY и не отвечают 500 «внутренняя ошибка».
 *
 * До 25.09.2026 списки Стола заказов пускали направление сортировки в запрос
 * и падали 500, остальные отвечали KIT_SORT_ORDER_INVALID, но со статусом 500
 * (C28-80).
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationInputDTO, PaginationUtils } from '@coopenomics/extension-kit';

describe('параметры списка', () => {
  it('направление сортировки вне ASC/DESC отклоняется проверкой ввода', async () => {
    const bad = await validate(plainToInstance(PaginationInputDTO, { page: 1, limit: 10, sortOrder: 'ASC, (select 1)' }));
    expect(bad.map((e) => e.property)).toContain('sortOrder');

    const good = await validate(plainToInstance(PaginationInputDTO, { page: 1, limit: 10, sortOrder: 'DESC' }));
    expect(good).toEqual([]);
  });

  it('отказы проверки параметров — 400 с кодом', () => {
    for (const [options, code] of [
      [{ page: 0, limit: 10, sortOrder: 'ASC' }, 'KIT_PAGE_NUMBER_INVALID'],
      [{ page: 1, limit: 5000, sortOrder: 'ASC' }, 'KIT_PAGE_LIMIT_INVALID'],
      [{ page: 1, limit: 10, sortOrder: 'UP' }, 'KIT_SORT_ORDER_INVALID'],
    ] as const) {
      const err = (() => {
        try {
          PaginationUtils.validatePaginationOptions(options as any);
        } catch (e) {
          return e as any;
        }
      })();
      expect(err.code).toBe(code);
      expect(err.getStatus()).toBe(400);
    }
  });
});
