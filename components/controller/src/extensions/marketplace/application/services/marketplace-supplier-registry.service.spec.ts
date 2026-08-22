/**
 * Unit-тесты MarketplaceSupplierRegistryService.
 *
 * Заменяет удалённый MarketplaceWhitelistService (PR #152, [598-51]) — тот
 * тестировал упразднённую концепцию whitelist (открытая витрина / по списку),
 * которой в коде больше нет. Реестр поставщиков — другая модель: заявка →
 * рассмотрение → APPROVED/REJECTED, допуск офферера строго по статусу.
 *
 * Покрывают:
 *  - isOfferer: сам кооператив всегда true (без похода в репозиторий),
 *    APPROVED → true, PENDING/REJECTED/нет записи → false, cache hit;
 *  - requestMembership: создание PENDING, идемпотентность повторной заявки,
 *    конфликт на уже APPROVED, переоткрытие REJECTED с новыми реквизитами;
 *  - addSupplier: upsert (create при отсутствии / patch при наличии) сразу в APPROVED;
 *  - approve/reject: патчат статус, инвалидируют isOfferer-кеш;
 *  - switchModel: SHARE — заглушка (ConflictException), MEMBERSHIP — сброс в PENDING.
 */
import { ConflictException } from '@nestjs/common';
import { MarketplaceSupplierRegistryService } from './marketplace-supplier-registry.service';
import { MarketplaceSupplierDomainEntity } from '../../domain/entities/marketplace-supplier.entity';
import {
  MarketplaceSupplierModel,
  MarketplaceSupplierStatus,
} from '../../domain/entities/marketplace-supplier.types';
import type { MarketplaceSupplierDomainRepository } from '../../domain/repositories/marketplace-supplier.repository';

const COOP = 'voskhod';

function makeSupplier(
  member: string,
  status: MarketplaceSupplierStatus,
  overrides: Partial<{
    model: MarketplaceSupplierModel;
    contract_number: string | null;
    contract_date: string | null;
    reviewed_by: string | null;
    reviewed_at: Date | null;
  }> = {}
): MarketplaceSupplierDomainEntity {
  return new MarketplaceSupplierDomainEntity({
    id: `id-${member}`,
    coopname: COOP,
    member_account: member,
    model: overrides.model ?? MarketplaceSupplierModel.MEMBERSHIP,
    status,
    contract_number: overrides.contract_number ?? '17/2026',
    contract_date: overrides.contract_date ?? '2026-05-01',
    contract_document_url: null,
    requested_by: member,
    requested_at: new Date('2026-05-01T00:00:00Z'),
    reviewed_by: overrides.reviewed_by ?? null,
    reviewed_at: overrides.reviewed_at ?? null,
  });
}

function makeRepo(): jest.Mocked<MarketplaceSupplierDomainRepository> {
  return {
    list: jest.fn(),
    findByMember: jest.fn(),
    create: jest.fn(),
    patch: jest.fn(),
    remove: jest.fn(),
  };
}

function makeEventBus() {
  return { emit: jest.fn() } as unknown as import('@nestjs/event-emitter').EventEmitter2;
}

describe('MarketplaceSupplierRegistryService', () => {
  describe('isOfferer', () => {
    it('сам кооператив → true без обращения к репозиторию (перепоставка остатков FR5)', async () => {
      const repo = makeRepo();
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await expect(service.isOfferer(COOP, COOP)).resolves.toBe(true);
      expect(repo.findByMember).not.toHaveBeenCalled();
    });

    it('запись APPROVED → true', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(makeSupplier('alice', MarketplaceSupplierStatus.APPROVED));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await expect(service.isOfferer(COOP, 'alice')).resolves.toBe(true);
    });

    it('запись PENDING → false (ещё не одобрен)', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(makeSupplier('alice', MarketplaceSupplierStatus.PENDING));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await expect(service.isOfferer(COOP, 'alice')).resolves.toBe(false);
    });

    it('записи нет → false', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(null);
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await expect(service.isOfferer(COOP, 'ghost')).resolves.toBe(false);
    });

    it('второй вызов того же пайщика — cache hit, repo не дёргается повторно', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(makeSupplier('alice', MarketplaceSupplierStatus.APPROVED));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await service.isOfferer(COOP, 'alice');
      await service.isOfferer(COOP, 'alice');
      expect(repo.findByMember).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestMembership', () => {
    it('без существующей записи → создаёт PENDING и эмитит уведомление председателю', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeSupplier('bob', MarketplaceSupplierStatus.PENDING));
      const eventBus = makeEventBus();
      const service = new MarketplaceSupplierRegistryService(repo, eventBus);

      const result = await service.requestMembership(COOP, 'bob', '17/2026', '2026-05-01');

      expect(result.status).toBe(MarketplaceSupplierStatus.PENDING);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coopname: COOP,
          member_account: 'bob',
          status: MarketplaceSupplierStatus.PENDING,
          contract_number: '17/2026',
          contract_date: '2026-05-01',
        })
      );
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
    });

    it('уже поданная PENDING-заявка → идемпотентна, возвращает существующую без повторной записи', async () => {
      const repo = makeRepo();
      const pending = makeSupplier('bob', MarketplaceSupplierStatus.PENDING);
      repo.findByMember.mockResolvedValue(pending);
      const eventBus = makeEventBus();
      const service = new MarketplaceSupplierRegistryService(repo, eventBus);

      const result = await service.requestMembership(COOP, 'bob', '17/2026', '2026-05-01');

      expect(result).toBe(pending);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.patch).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('уже APPROVED → 409 Conflict, повторная заявка запрещена', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(makeSupplier('bob', MarketplaceSupplierStatus.APPROVED));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await expect(service.requestMembership(COOP, 'bob', '17/2026', '2026-05-01')).rejects.toThrow(
        ConflictException
      );
      expect(repo.patch).not.toHaveBeenCalled();
    });

    it('REJECTED → переоткрывает заявку в PENDING с новыми реквизитами договора', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(makeSupplier('bob', MarketplaceSupplierStatus.REJECTED));
      repo.patch.mockResolvedValue(
        makeSupplier('bob', MarketplaceSupplierStatus.PENDING, {
          contract_number: '18/2026',
          contract_date: '2026-06-01',
        })
      );
      const eventBus = makeEventBus();
      const service = new MarketplaceSupplierRegistryService(repo, eventBus);

      const result = await service.requestMembership(COOP, 'bob', '18/2026', '2026-06-01');

      expect(repo.patch).toHaveBeenCalledWith(
        COOP,
        'bob',
        expect.objectContaining({
          status: MarketplaceSupplierStatus.PENDING,
          contract_number: '18/2026',
          contract_date: '2026-06-01',
          reviewed_by: null,
          reviewed_at: null,
        })
      );
      expect(result.contract_number).toBe('18/2026');
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('addSupplier (путь 2 — прямое добавление администратором)', () => {
    it('без существующей записи → создаёт сразу APPROVED', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeSupplier('carl', MarketplaceSupplierStatus.APPROVED));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      const result = await service.addSupplier(
        COOP,
        'carl',
        MarketplaceSupplierModel.MEMBERSHIP,
        '19/2026',
        '2026-06-10',
        'chairman1'
      );

      expect(result.status).toBe(MarketplaceSupplierStatus.APPROVED);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: MarketplaceSupplierStatus.APPROVED, requested_by: 'chairman1', reviewed_by: 'chairman1' })
      );
      expect(repo.patch).not.toHaveBeenCalled();
    });

    it('с существующей записью → upsert через patch в APPROVED', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValue(makeSupplier('carl', MarketplaceSupplierStatus.REJECTED));
      repo.patch.mockResolvedValue(makeSupplier('carl', MarketplaceSupplierStatus.APPROVED));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await service.addSupplier(COOP, 'carl', MarketplaceSupplierModel.MEMBERSHIP, '20/2026', '2026-06-11', 'chairman1');

      expect(repo.patch).toHaveBeenCalledWith(
        COOP,
        'carl',
        expect.objectContaining({ status: MarketplaceSupplierStatus.APPROVED, reviewed_by: 'chairman1' })
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('инвалидирует isOfferer-кеш кооператива', async () => {
      const repo = makeRepo();
      repo.findByMember.mockResolvedValueOnce(null); // прогрев кеша isOfferer('dave') → false
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());
      await expect(service.isOfferer(COOP, 'dave')).resolves.toBe(false);

      repo.findByMember.mockResolvedValueOnce(null); // addSupplier сам ищет существующую запись
      repo.create.mockResolvedValue(makeSupplier('dave', MarketplaceSupplierStatus.APPROVED));
      await service.addSupplier(COOP, 'dave', MarketplaceSupplierModel.MEMBERSHIP, '21/2026', '2026-06-12', 'chairman1');

      repo.findByMember.mockResolvedValueOnce(makeSupplier('dave', MarketplaceSupplierStatus.APPROVED));
      await expect(service.isOfferer(COOP, 'dave')).resolves.toBe(true);
      // Без инвалидации второй вызов взял бы старое значение из кеша (false) без похода в repo.
      expect(repo.findByMember).toHaveBeenCalledTimes(3);
    });
  });

  describe('approve / reject', () => {
    it('approve патчит статус в APPROVED', async () => {
      const repo = makeRepo();
      repo.patch.mockResolvedValue(makeSupplier('eve', MarketplaceSupplierStatus.APPROVED));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      const result = await service.approve(COOP, 'eve', 'chairman1');

      expect(result.status).toBe(MarketplaceSupplierStatus.APPROVED);
      expect(repo.patch).toHaveBeenCalledWith(
        COOP,
        'eve',
        expect.objectContaining({ status: MarketplaceSupplierStatus.APPROVED, reviewed_by: 'chairman1' })
      );
    });

    it('reject патчит статус в REJECTED', async () => {
      const repo = makeRepo();
      repo.patch.mockResolvedValue(makeSupplier('eve', MarketplaceSupplierStatus.REJECTED));
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      const result = await service.reject(COOP, 'eve', 'chairman1');

      expect(result.status).toBe(MarketplaceSupplierStatus.REJECTED);
      expect(repo.patch).toHaveBeenCalledWith(
        COOP,
        'eve',
        expect.objectContaining({ status: MarketplaceSupplierStatus.REJECTED, reviewed_by: 'chairman1' })
      );
    });
  });

  describe('switchModel', () => {
    it('SHARE — заглушка, 409 Conflict, репозиторий не трогается', async () => {
      const repo = makeRepo();
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      await expect(
        service.switchModel(COOP, 'alice', MarketplaceSupplierModel.SHARE, null, null)
      ).rejects.toThrow(ConflictException);
      expect(repo.patch).not.toHaveBeenCalled();
    });

    it('MEMBERSHIP — сбрасывает запись в PENDING с новым договором', async () => {
      const repo = makeRepo();
      repo.patch.mockResolvedValue(
        makeSupplier('alice', MarketplaceSupplierStatus.PENDING, {
          model: MarketplaceSupplierModel.MEMBERSHIP,
        })
      );
      const service = new MarketplaceSupplierRegistryService(repo, makeEventBus());

      const result = await service.switchModel(
        COOP,
        'alice',
        MarketplaceSupplierModel.MEMBERSHIP,
        '22/2026',
        '2026-06-15'
      );

      expect(result.status).toBe(MarketplaceSupplierStatus.PENDING);
      expect(repo.patch).toHaveBeenCalledWith(
        COOP,
        'alice',
        expect.objectContaining({
          model: MarketplaceSupplierModel.MEMBERSHIP,
          status: MarketplaceSupplierStatus.PENDING,
          contract_number: '22/2026',
          contract_date: '2026-06-15',
          reviewed_by: null,
          reviewed_at: null,
        })
      );
    });
  });
});
