/**
 * Unit-тесты MarketplaceVitrineService (Story 3.1).
 *
 * Покрывают AC:
 *   - getDefault возвращает запись, если есть; null если нет;
 *   - list возвращает все витрины кооператива (в MVP всегда одна).
 */
import { MarketplaceVitrineService } from '~/extensions/marketplace/application/services/marketplace-vitrine.service';
import { MarketplaceVitrineDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-vitrine.entity';
import type { MarketplaceVitrineDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-vitrine.repository';

const COOP = 'voskhod';

function makeVitrine(id: string, isDefault: boolean): MarketplaceVitrineDomainEntity {
  return new MarketplaceVitrineDomainEntity({
    id,
    coopname: COOP,
    display_name: 'Стол заказов',
    is_default: isDefault,
    created_at: new Date('2026-05-15T12:00:00Z'),
    updated_at: new Date('2026-05-15T12:00:00Z'),
  });
}

function makeRepo(): jest.Mocked<MarketplaceVitrineDomainRepository> {
  return {
    findDefault: jest.fn(),
    list: jest.fn(),
    ensureDefault: jest.fn(),
  };
}

describe('MarketplaceVitrineService', () => {
  it('getDefault возвращает запись из репозитория', async () => {
    const repo = makeRepo();
    repo.findDefault.mockResolvedValue(makeVitrine('default', true));
    const service = new MarketplaceVitrineService(repo);

    const result = await service.getDefault(COOP);
    expect(result?.id).toBe('default');
    expect(result?.is_default).toBe(true);
  });

  it('getDefault возвращает null если витрины нет', async () => {
    const repo = makeRepo();
    repo.findDefault.mockResolvedValue(null);
    const service = new MarketplaceVitrineService(repo);

    await expect(service.getDefault(COOP)).resolves.toBeNull();
  });

  it('list возвращает все витрины кооператива', async () => {
    const repo = makeRepo();
    repo.list.mockResolvedValue([makeVitrine('default', true)]);
    const service = new MarketplaceVitrineService(repo);

    const result = await service.list(COOP);
    expect(result).toHaveLength(1);
  });
});
