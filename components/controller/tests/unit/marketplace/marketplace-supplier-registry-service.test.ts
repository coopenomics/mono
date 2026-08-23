/**
 * Unit-тесты MarketplaceSupplierRegistryService — эмиссия событий уведомлений
 * вокруг заявки поставщика на допуск (членская модель, путь 1).
 *
 * Контракт: подача заявки эмитит MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT
 * (председателю — «есть заявка на рассмотрение»); одобрение эмитит
 * MARKETPLACE_SUPPLIER_APPROVED_EVENT (заявителю — «допуск открыт»). До этого
 * теста approve() решение председателя молча не уведомляло заявителя.
 */
import { MarketplaceSupplierRegistryService } from '~/extensions/marketplace/application/services/marketplace-supplier-registry.service';
import {
  MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT,
  MARKETPLACE_SUPPLIER_APPROVED_EVENT,
} from '~/extensions/marketplace/application/events/marketplace-notification.events';
import {
  MarketplaceSupplierModel,
  MarketplaceSupplierStatus,
} from '~/extensions/marketplace/domain/entities/marketplace-supplier.types';
import { MarketplaceSupplierDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-supplier.entity';

function makeEntity(
  overrides: Partial<ConstructorParameters<typeof MarketplaceSupplierDomainEntity>[0]> = {}
): MarketplaceSupplierDomainEntity {
  return new MarketplaceSupplierDomainEntity({
    id: 'id-1',
    coopname: 'voskhod',
    member_account: 'alice',
    model: MarketplaceSupplierModel.MEMBERSHIP,
    status: MarketplaceSupplierStatus.PENDING,
    contract_number: '42/2026',
    contract_date: '2026-07-01',
    contract_document_url: null,
    requested_by: 'alice',
    requested_at: new Date('2026-07-01T00:00:00Z'),
    reviewed_by: null,
    reviewed_at: null,
    ...overrides,
  });
}

function makeService() {
  const repo = {
    list: jest.fn(),
    findByMember: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(makeEntity()),
    patch: jest.fn().mockResolvedValue(
      makeEntity({ status: MarketplaceSupplierStatus.APPROVED, reviewed_by: 'chairman' })
    ),
    remove: jest.fn(),
  };
  const eventBus = { emit: jest.fn() } as any;
  const service = new MarketplaceSupplierRegistryService(repo as any, eventBus);
  return { service, repo, eventBus };
}

describe('MarketplaceSupplierRegistryService', () => {
  it('requestMembership() (новая заявка) эмитит MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT', async () => {
    const { service, eventBus } = makeService();
    await service.requestMembership('voskhod', 'alice', '42/2026', '2026-07-01');
    expect(eventBus.emit).toHaveBeenCalledWith(MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT, {
      coopname: 'voskhod',
      member_account: 'alice',
      contract_number: '42/2026',
    });
  });

  it('approve() (решение председателя) эмитит MARKETPLACE_SUPPLIER_APPROVED_EVENT заявителю', async () => {
    const { service, repo, eventBus } = makeService();
    await service.approve('voskhod', 'alice', 'chairman');
    expect(repo.patch).toHaveBeenCalledWith('voskhod', 'alice', {
      status: MarketplaceSupplierStatus.APPROVED,
      reviewed_by: 'chairman',
      reviewed_at: expect.any(Date),
    });
    expect(eventBus.emit).toHaveBeenCalledWith(MARKETPLACE_SUPPLIER_APPROVED_EVENT, {
      coopname: 'voskhod',
      member_account: 'alice',
      contract_number: '42/2026',
    });
  });

  it('approve() без contract_number в записи (edge case) эмитит событие с пустой строкой, не падает', async () => {
    const { service, repo, eventBus } = makeService();
    repo.patch.mockResolvedValueOnce(
      makeEntity({ status: MarketplaceSupplierStatus.APPROVED, contract_number: null })
    );
    await service.approve('voskhod', 'alice', 'chairman');
    expect(eventBus.emit).toHaveBeenCalledWith(
      MARKETPLACE_SUPPLIER_APPROVED_EVENT,
      expect.objectContaining({ contract_number: '' })
    );
  });

  it('reject() НЕ эмитит MARKETPLACE_SUPPLIER_APPROVED_EVENT (только approve — решение об открытии допуска)', async () => {
    const { service, repo, eventBus } = makeService();
    repo.patch.mockResolvedValueOnce(makeEntity({ status: MarketplaceSupplierStatus.REJECTED }));
    await service.reject('voskhod', 'alice', 'chairman');
    expect(eventBus.emit).not.toHaveBeenCalledWith(
      MARKETPLACE_SUPPLIER_APPROVED_EVENT,
      expect.anything()
    );
  });
});
