/**
 * Миграция v22 Стола заказов: заявления на гарантийный возврат со снятым статусом
 * ACCEPTED_AT_VISIT переводятся в ACCEPTED_BY_COUNCIL, иначе GraphQL не отдаёт
 * список заявлений целиком.
 */
import { marketplaceBootstrapV22Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v22.migration';
import { MarketplaceReturnClaimStatuses } from '~/extensions/marketplace/domain/entities/marketplace-return-claim.types';

function makeCtx(dataSource: unknown) {
  return {
    resolve: jest.fn(() => dataSource),
    logInfo: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
  } as any;
}

describe('marketplaceBootstrapV22Migration', () => {
  it('переводит заявления со старым статусом и сообщает, сколько', async () => {
    const query = jest.fn(async () => [[{ id: 'c1' }, { id: 'c2' }], 2]);
    const ctx = makeCtx({ query });
    await marketplaceBootstrapV22Migration.afterMigrate!(ctx);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = (query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(sql).toContain('UPDATE marketplace_return_claim SET status = $1 WHERE status = $2');
    expect(params).toEqual([MarketplaceReturnClaimStatuses.ACCEPTED_BY_COUNCIL, 'ACCEPTED_AT_VISIT']);
    expect(ctx.logInfo).toHaveBeenCalledWith(expect.stringContaining(': 2.'));
  });

  it('старых заявлений нет — ничего не пишет в журнал', async () => {
    const ctx = makeCtx({ query: jest.fn(async () => [[], 0]) });
    await marketplaceBootstrapV22Migration.afterMigrate!(ctx);
    expect(ctx.logInfo).not.toHaveBeenCalled();
  });

  it('без источника данных стола заказов пропускается', async () => {
    const ctx = makeCtx(undefined);
    await expect(marketplaceBootstrapV22Migration.afterMigrate!(ctx)).resolves.toBeUndefined();
  });

  it('конфиг расширения не меняет', () => {
    expect(marketplaceBootstrapV22Migration.version).toBe(22);
    expect(marketplaceBootstrapV22Migration.migrate({ a: 1 } as any, { a: 0, b: 2 } as any)).toEqual({ a: 1, b: 2 });
  });
});
