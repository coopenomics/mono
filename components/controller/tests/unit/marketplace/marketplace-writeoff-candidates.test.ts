/**
 * Кандидаты списания: группировка партий (задача 99D-13).
 *
 * Партии одного наименования на одном участке в одном состоянии сливаются в
 * одну строку, чтобы председатель не видел «прыгающее количество». Но
 * возвращённое пайщиком по гарантии — отдельной строкой со своим
 * происхождением: это имущество, по которому была рекламация, и списывать
 * его нужно осознанно.
 */
import { MarketplaceWriteoffService } from '~/extensions/marketplace/application/services/marketplace-writeoff.service';
import { MarketplaceInventoryOrigins } from '~/extensions/marketplace/domain/entities/marketplace-inventory.types';
import { MarketplaceUnitsOfMeasure } from '~/extensions/marketplace/domain/entities/marketplace-offer.types';

const COOP = 'voskhod';
const BRANCH = 'krg';

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    inventory_id: 'inv-1',
    braname: BRANCH,
    origin: MarketplaceInventoryOrigins.RECEPTION,
    asset_title: 'Берёзовый сок',
    quantity: 2,
    arrival_price: '50.0000',
    package_size: 0,
    unit_of_measure: MarketplaceUnitsOfMeasure.PIECE,
    expiry_date: null,
    is_expired: false,
    ...overrides,
  };
}

function makeService(candidates: unknown[]) {
  const service = new MarketplaceWriteoffService(
    { findActiveLockedInventoryIds: jest.fn().mockResolvedValue([]) } as never,
    { findWriteoffCandidates: jest.fn().mockResolvedValue(candidates) } as never,
    { findById: jest.fn() } as never,
    {} as never,
    { symbol: 'RUB', decimals: 4 } as never,
    {} as never,
    { resolveBranchDisplay: jest.fn().mockResolvedValue({ name: 'Красногорск' }) } as never,
    { emit: jest.fn() } as never,
    { setContext: jest.fn(), log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never
  );
  return service;
}

describe('MarketplaceWriteoffService.listCandidates: происхождение партии', () => {
  it('партии одного происхождения складываются в одну строку', async () => {
    const service = makeService([candidate({ inventory_id: 'inv-1' }), candidate({ inventory_id: 'inv-2', quantity: 3 })]);
    const rows = await service.listCandidates(COOP);
    expect(rows).toHaveLength(1);
    expect(rows[0].origin).toBe(MarketplaceInventoryOrigins.RECEPTION);
    expect(rows[0].quantity).toBe('5');
    expect(rows[0].inventory_ids).toEqual(['inv-1', 'inv-2']);
  });

  it('гарантийный возврат того же наименования — отдельной строкой со своим происхождением', async () => {
    const service = makeService([
      candidate({ inventory_id: 'inv-1' }),
      candidate({ inventory_id: 'inv-ret', origin: MarketplaceInventoryOrigins.WARRANTY_RETURN, quantity: 1 }),
    ]);
    const rows = await service.listCandidates(COOP);
    expect(rows).toHaveLength(2);
    const returned = rows.find((r) => r.origin === MarketplaceInventoryOrigins.WARRANTY_RETURN);
    expect(returned?.inventory_ids).toEqual(['inv-ret']);
    expect(returned?.quantity).toBe('1');
    expect(rows.find((r) => r.origin === MarketplaceInventoryOrigins.RECEPTION)?.inventory_ids).toEqual(['inv-1']);
  });
});
