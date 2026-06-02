/**
 * Story 6.4 (Epic 6): контрактный тест BaseBlockchainRepository.applyBcChecksum.
 *
 * - Если entity.bc задан → typeormEntity._checksum = computeBcChecksum(entity.bc).
 * - Если entity.bc отсутствует → typeormEntity._checksum = computeBcChecksum(null).
 *
 * Не подключаем TypeORM/PG — тест чисто структурный, через subclass-стаб.
 */

import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { computeBcChecksum } from '~/shared/sync/checksum.util';

class TestRepo extends BaseBlockchainRepository<any, any> {
  constructor() {
    super(null as any, null as any);
  }
  protected getMapper() {
    return { toDomain: (e: any) => e, toEntity: (d: any) => d };
  }
  protected createDomainEntity(_db: any, _bc: any): any {
    return null;
  }
  protected getSyncKey(): string {
    return 'id';
  }
  // expose protected method
  public callApply(domain: any, typeormEntity: any): void {
    this.applyBcChecksum(domain, typeormEntity);
  }
}

describe('Story 6.4: BaseBlockchainRepository.applyBcChecksum', () => {
  it('entity.bc задан → _checksum = sha256(canonical-json(bc))', () => {
    const repo = new TestRepo();
    const bc = { id: 1, title: 'X', coopname: 'voskhod' };
    const tEntity: any = {};
    repo.callApply({ bc }, tEntity);
    expect(tEntity._checksum).toBe(computeBcChecksum(bc));
    expect(tEntity._checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('entity.bc undefined → _checksum от null (стабильно)', () => {
    const repo = new TestRepo();
    const tEntity: any = {};
    repo.callApply({}, tEntity);
    expect(tEntity._checksum).toBe(computeBcChecksum(null));
  });

  it('детерминированность: одинаковая bc → одинаковый _checksum через два вызова', () => {
    const repo = new TestRepo();
    const bc = { id: 1, title: 'X' };
    const t1: any = {};
    const t2: any = {};
    repo.callApply({ bc }, t1);
    repo.callApply({ bc: { ...bc } }, t2);
    expect(t1._checksum).toBe(t2._checksum);
  });
});
