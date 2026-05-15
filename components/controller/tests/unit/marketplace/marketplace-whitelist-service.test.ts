/**
 * Unit-тесты MarketplaceWhitelistService (Story 3.1).
 *
 * Покрывают AC:
 *   - listWhitelist возвращает все записи (auto-coop + manual);
 *   - addToWhitelist создаёт role='manual', проставляет added_by;
 *   - removeFromWhitelist удаляет manual-запись и инвалидирует кеш;
 *   - removeFromWhitelist на auto-coop → 403 Forbidden (FR5);
 *   - removeFromWhitelist на отсутствующего → 404 NotFound;
 *   - isOfferer семантика «открытая витрина» (whitelist только auto-coop)
 *     → true для всех;
 *   - isOfferer семантика «по whitelist» → true только для записанных;
 *   - isOfferer cache hit без обращения к репозиторию.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { MarketplaceWhitelistService } from '~/extensions/marketplace/application/services/marketplace-whitelist.service';
import { MarketplaceWhitelistEntryDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-whitelist-entry.entity';
import type { MarketplaceWhitelistDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-whitelist.repository';

const COOP = 'voskhod';

function makeEntry(member: string, role: 'auto-coop' | 'manual'): MarketplaceWhitelistEntryDomainEntity {
  return new MarketplaceWhitelistEntryDomainEntity({
    id: `id-${member}`,
    cooperative_id: COOP,
    member_account: member,
    role,
    added_by: role === 'auto-coop' ? null : 'admin',
    added_at: new Date('2026-05-15T12:00:00Z'),
  });
}

function makeRepo(): jest.Mocked<MarketplaceWhitelistDomainRepository> {
  return {
    list: jest.fn(),
    findByMember: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    countManual: jest.fn(),
  };
}

describe('MarketplaceWhitelistService', () => {
  it('list возвращает все записи', async () => {
    const repo = makeRepo();
    repo.list.mockResolvedValue([makeEntry(COOP, 'auto-coop'), makeEntry('alice', 'manual')]);
    const service = new MarketplaceWhitelistService(repo);

    const result = await service.list(COOP);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.member_account)).toEqual([COOP, 'alice']);
  });

  it('addToWhitelist создаёт manual-запись с added_by', async () => {
    const repo = makeRepo();
    repo.add.mockResolvedValue(makeEntry('bob', 'manual'));
    const service = new MarketplaceWhitelistService(repo);

    const entry = await service.addToWhitelist(COOP, 'bob', 'admin');
    expect(entry.member_account).toBe('bob');
    expect(entry.role).toBe('manual');
    expect(repo.add).toHaveBeenCalledWith(COOP, 'bob', 'manual', 'admin');
  });

  it('removeFromWhitelist удаляет manual-запись', async () => {
    const repo = makeRepo();
    repo.findByMember.mockResolvedValue(makeEntry('bob', 'manual'));
    const service = new MarketplaceWhitelistService(repo);

    await service.removeFromWhitelist(COOP, 'bob');
    expect(repo.remove).toHaveBeenCalledWith(COOP, 'bob');
  });

  it('removeFromWhitelist на auto-coop → 403 (FR5)', async () => {
    const repo = makeRepo();
    repo.findByMember.mockResolvedValue(makeEntry(COOP, 'auto-coop'));
    const service = new MarketplaceWhitelistService(repo);

    await expect(service.removeFromWhitelist(COOP, COOP)).rejects.toThrow(ForbiddenException);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('removeFromWhitelist на отсутствующего → 404 NotFound', async () => {
    const repo = makeRepo();
    repo.findByMember.mockResolvedValue(null);
    const service = new MarketplaceWhitelistService(repo);

    await expect(service.removeFromWhitelist(COOP, 'ghost')).rejects.toThrow(NotFoundException);
  });

  it('isOfferer: открытая витрина (только auto-coop) → true для всех', async () => {
    const repo = makeRepo();
    repo.countManual.mockResolvedValue(0);
    const service = new MarketplaceWhitelistService(repo);

    await expect(service.isOfferer(COOP, 'random_user')).resolves.toBe(true);
    expect(repo.findByMember).not.toHaveBeenCalled();
  });

  it('isOfferer: whitelist непустой, пайщик внутри → true', async () => {
    const repo = makeRepo();
    repo.countManual.mockResolvedValue(2);
    repo.findByMember.mockResolvedValue(makeEntry('alice', 'manual'));
    const service = new MarketplaceWhitelistService(repo);

    await expect(service.isOfferer(COOP, 'alice')).resolves.toBe(true);
  });

  it('isOfferer: whitelist непустой, пайщик снаружи → false', async () => {
    const repo = makeRepo();
    repo.countManual.mockResolvedValue(2);
    repo.findByMember.mockResolvedValue(null);
    const service = new MarketplaceWhitelistService(repo);

    await expect(service.isOfferer(COOP, 'random_user')).resolves.toBe(false);
  });

  it('isOfferer: второй вызов того же пайщика — cache hit, repo не дёргается', async () => {
    const repo = makeRepo();
    repo.countManual.mockResolvedValue(0);
    const service = new MarketplaceWhitelistService(repo);

    await service.isOfferer(COOP, 'alice');
    await service.isOfferer(COOP, 'alice');
    expect(repo.countManual).toHaveBeenCalledTimes(1);
  });

  it('addToWhitelist инвалидирует кеш isOfferer', async () => {
    const repo = makeRepo();
    repo.countManual.mockResolvedValueOnce(0);
    repo.add.mockResolvedValue(makeEntry('alice', 'manual'));
    repo.countManual.mockResolvedValueOnce(1);
    repo.findByMember.mockResolvedValue(null);
    const service = new MarketplaceWhitelistService(repo);

    // Прогрев кеша: открытая витрина → true
    await expect(service.isOfferer(COOP, 'random_user')).resolves.toBe(true);
    // Добавление manual-записи (alice) → инвалидирует кеш
    await service.addToWhitelist(COOP, 'alice', 'admin');
    // После инвалидации семантика «по whitelist» → false для random_user
    await expect(service.isOfferer(COOP, 'random_user')).resolves.toBe(false);
  });

  it('removeFromWhitelist инвалидирует кеш isOfferer', async () => {
    const repo = makeRepo();
    // Прогрев isOfferer: countManual=1 + findByMember(random_user)=null → false.
    // Затем remove('alice'): findByMember(alice)=manual-entry, repo.remove() ok.
    // Второй isOfferer: countManual=0 → семантика «открытая витрина» → true,
    // findByMember не дёргается (короткое замыкание).
    repo.countManual.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    repo.findByMember
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeEntry('alice', 'manual'));
    const service = new MarketplaceWhitelistService(repo);

    await expect(service.isOfferer(COOP, 'random_user')).resolves.toBe(false);
    await service.removeFromWhitelist(COOP, 'alice');
    await expect(service.isOfferer(COOP, 'random_user')).resolves.toBe(true);
  });
});
