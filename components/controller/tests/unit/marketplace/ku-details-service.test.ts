/**
 * Unit-тесты KuDetailsService (Story 2.1 + 2.2, после переезда реквизитов в
 * единый источник правды — организацию участка).
 *
 * Покрывают:
 *  - detailKU создаёт новую запись с status='ACTIVE' и triggers геокодинг по
 *    адресу организации участка;
 *  - повторный detailKU без смены адреса организации не сбрасывает координаты OK;
 *  - смена адреса организации сбрасывает геокодинг в PENDING и запускает заново;
 *  - геокодер FAILED → запись хранит статус FAILED + errorMessage;
 *  - setStatus меняет ACTIVE↔INACTIVE; запись отсутствует → NotFoundException;
 *  - list проксирует onlyActive; foreign-coopname → NotFoundException;
 *  - retryGeocode перезапускает геокодер по адресу организации.
 */
import { KuDetailsService } from '~/extensions/marketplace/application/services/ku-details.service';
import { KuDetailsDomainEntity } from '~/extensions/marketplace/domain/entities/ku-details-domain.entity';
import type { KuDetailsDomainRepository } from '~/extensions/marketplace/domain/repositories/ku-details-domain.repository';
import type { GeocoderPort, GeocoderResult } from '~/extensions/marketplace/domain/ports/geocoder.port';
import type { OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    coopname: 'voskhod',
  },
}));

class InMemoryKuDetailsRepo implements KuDetailsDomainRepository {
  private store: Map<string, KuDetailsDomainEntity> = new Map();
  private idSeq = 0;

  private key(coopname: string, braname: string): string {
    return `${coopname}::${braname}`;
  }

  async findByCoreBraname(coopname: string, coreBraname: string): Promise<KuDetailsDomainEntity | null> {
    return this.store.get(this.key(coopname, coreBraname)) ?? null;
  }

  async findByCoopname(
    coopname: string,
    options: { onlyActive?: boolean } = {}
  ): Promise<KuDetailsDomainEntity[]> {
    const rows = [...this.store.values()].filter((row) => row.coopname === coopname);
    return options.onlyActive ? rows.filter((row) => row.status === 'ACTIVE') : rows;
  }

  async save(entity: KuDetailsDomainEntity): Promise<KuDetailsDomainEntity> {
    const next = new KuDetailsDomainEntity({
      ...entity,
      id: entity.id ?? ++this.idSeq,
    });
    this.store.set(this.key(next.coopname, next.coreBraname), next);
    return next;
  }

  async updateGeocode(
    coopname: string,
    coreBraname: string,
    payload: {
      status: 'PENDING' | 'OK' | 'FAILED';
      lat?: number;
      lng?: number;
      errorMessage?: string;
      geocodedAt: Date;
      geocodedAddress?: string;
    }
  ): Promise<KuDetailsDomainEntity | null> {
    const existing = this.store.get(this.key(coopname, coreBraname));
    if (!existing) return null;
    const updated = new KuDetailsDomainEntity({
      ...existing,
      geocodeStatus: payload.status,
      lat: payload.lat,
      lng: payload.lng,
      geocodeErrorMessage: payload.errorMessage,
      geocodedAt: payload.geocodedAt,
      geocodedAddress: payload.geocodedAddress ?? existing.geocodedAddress,
    });
    this.store.set(this.key(coopname, coreBraname), updated);
    return updated;
  }

  async setStatus(
    coopname: string,
    coreBraname: string,
    status: 'ACTIVE' | 'INACTIVE'
  ): Promise<KuDetailsDomainEntity | null> {
    const existing = this.store.get(this.key(coopname, coreBraname));
    if (!existing) return null;
    const updated = new KuDetailsDomainEntity({ ...existing, status });
    this.store.set(this.key(coopname, coreBraname), updated);
    return updated;
  }
}

class StubGeocoder implements GeocoderPort {
  result: GeocoderResult = { status: 'OK', lat: 55.755826, lng: 37.617299 };
  public calls: string[] = [];

  async geocode(addressFull: string): Promise<GeocoderResult> {
    this.calls.push(addressFull);
    return this.result;
  }
}

// Организация участка — единый источник правды реквизитов (адрес/контакты).
class StubOrgRepo implements OrganizationRepository {
  public addresses = new Map<string, string>();

  async findByUsername(username: string): Promise<OrganizationDomainInterface> {
    return {
      username,
      type: 'organization',
      short_name: `КУ ${username}`,
      full_name: `Кооперативный участок ${username}`,
      fact_address: this.addresses.get(username) ?? '',
      full_address: '',
      phone: '+7 495 123-45-67',
      email: `${username}@voskhod.coop`,
      country: 'RU',
      city: 'Москва',
      represented_by: {} as OrganizationDomainInterface['represented_by'],
      details: {} as OrganizationDomainInterface['details'],
    };
  }

  async create(): Promise<void> {
    /* no-op */
  }
}

const sampleInput = () => ({
  coopname: 'voskhod',
  coreBraname: 'voskhod1',
  workingHours: { mon: { open: '09:00', close: '18:00', breaks: [] } },
  description: undefined,
});

describe('KuDetailsService', () => {
  let repo: InMemoryKuDetailsRepo;
  let geocoder: StubGeocoder;
  let orgRepo: StubOrgRepo;
  let service: KuDetailsService;

  beforeEach(() => {
    repo = new InMemoryKuDetailsRepo();
    geocoder = new StubGeocoder();
    orgRepo = new StubOrgRepo();
    orgRepo.addresses.set('voskhod1', 'г. Москва, ул. Тверская, 1');
    service = new KuDetailsService(repo, geocoder, orgRepo);
  });

  async function flushGeocode() {
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('detailKU создаёт новую запись со статусом ACTIVE и triggers геокодинг по адресу организации', async () => {
    const result = await service.detailKU(sampleInput());
    await flushGeocode();

    const stored = await repo.findByCoreBraname('voskhod', 'voskhod1');
    expect(result.coreBraname).toBe('voskhod1');
    expect(result.status).toBe('ACTIVE');
    expect(stored?.geocodeStatus).toBe('OK');
    expect(stored?.lat).toBeCloseTo(55.755826, 5);
    expect(geocoder.calls).toEqual(['г. Москва, ул. Тверская, 1']);
  });

  it('повторный detailKU без смены адреса организации не запускает геокодер заново', async () => {
    await service.detailKU(sampleInput());
    await flushGeocode();
    geocoder.calls = [];

    const input = { ...sampleInput(), description: 'Описание изменено' };
    await service.detailKU(input);
    await flushGeocode();

    expect(geocoder.calls).toEqual([]);
    const stored = await repo.findByCoreBraname('voskhod', 'voskhod1');
    expect(stored?.geocodeStatus).toBe('OK');
    expect(stored?.description).toBe('Описание изменено');
  });

  it('смена адреса организации сбрасывает координаты в PENDING и запускает геокодер', async () => {
    await service.detailKU(sampleInput());
    await flushGeocode();
    geocoder.result = { status: 'OK', lat: 59.9342802, lng: 30.3350986 };
    geocoder.calls = [];

    orgRepo.addresses.set('voskhod1', 'СПб, Невский, 1');
    await service.detailKU(sampleInput());
    await flushGeocode();

    expect(geocoder.calls).toEqual(['СПб, Невский, 1']);
    const stored = await repo.findByCoreBraname('voskhod', 'voskhod1');
    expect(stored?.lat).toBeCloseTo(59.9342802, 5);
    expect(stored?.geocodeStatus).toBe('OK');
  });

  it('геокодер FAILED → запись хранит статус FAILED + errorMessage, основная мутация прошла', async () => {
    geocoder.result = { status: 'FAILED', errorMessage: 'Geocoder вернул пустой результат' };
    const result = await service.detailKU(sampleInput());
    await flushGeocode();

    expect(result.coreBraname).toBe('voskhod1');
    const stored = await repo.findByCoreBraname('voskhod', 'voskhod1');
    expect(stored?.geocodeStatus).toBe('FAILED');
    expect(stored?.geocodeErrorMessage).toBe('Geocoder вернул пустой результат');
    expect(stored?.lat).toBeUndefined();
  });

  it('setStatus переключает ACTIVE→INACTIVE и обратно', async () => {
    await service.detailKU(sampleInput());
    await flushGeocode();

    const deactivated = await service.setStatus({
      coopname: 'voskhod',
      coreBraname: 'voskhod1',
      status: 'INACTIVE',
    });
    expect(deactivated.status).toBe('INACTIVE');

    const reactivated = await service.setStatus({
      coopname: 'voskhod',
      coreBraname: 'voskhod1',
      status: 'ACTIVE',
    });
    expect(reactivated.status).toBe('ACTIVE');
  });

  it('setStatus на несуществующую запись → NotFoundException', async () => {
    await expect(
      service.setStatus({ coopname: 'voskhod', coreBraname: 'no-such', status: 'INACTIVE' })
    ).rejects.toThrow(/marketplace_ku_details не найдена/);
  });

  it('list onlyActive=true возвращает только ACTIVE записи', async () => {
    orgRepo.addresses.set('voskhod2', 'г. Москва, ул. Арбат, 2');
    await service.detailKU(sampleInput());
    await flushGeocode();
    await service.detailKU({ ...sampleInput(), coreBraname: 'voskhod2' });
    await flushGeocode();
    await service.setStatus({ coopname: 'voskhod', coreBraname: 'voskhod2', status: 'INACTIVE' });

    const all = await service.list({ coopname: 'voskhod', onlyActive: false });
    const active = await service.list({ coopname: 'voskhod', onlyActive: true });

    expect(all).toHaveLength(2);
    expect(active).toHaveLength(1);
    expect(active[0]?.coreBraname).toBe('voskhod1');
  });

  it('foreign coopname отклоняется NotFoundException', async () => {
    await expect(service.detailKU({ ...sampleInput(), coopname: 'other' })).rejects.toThrow(
      /Controller обслуживает кооператив "voskhod"/
    );
  });

  it('retryGeocode пересчитывает координаты по адресу организации', async () => {
    geocoder.result = { status: 'FAILED', errorMessage: 'temporary' };
    await service.detailKU(sampleInput());
    await flushGeocode();

    geocoder.result = { status: 'OK', lat: 55.0, lng: 37.0 };
    const refreshed = await service.retryGeocode('voskhod', 'voskhod1');

    expect(refreshed.geocodeStatus).toBe('OK');
    expect(refreshed.lat).toBeCloseTo(55.0, 5);
  });
});
