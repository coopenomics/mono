import { KuDetailsDomainEntity } from '~/extensions/marketplace/domain/entities/ku-details-domain.entity';
import { KuDetailsTypeormEntity } from '~/extensions/marketplace/infrastructure/entities/ku-details.entity';
import { KuDetailsMapper } from '~/extensions/marketplace/infrastructure/mappers/ku-details.mapper';

/**
 * Unit-тесты KuDetailsMapper (Story 2.1).
 *
 * Проверяют round-trip Domain ↔ TypeORM: все поля сохраняются без потерь;
 * undefined остаётся undefined (а не null), enum-статусы передаются как есть.
 */
describe('KuDetailsMapper', () => {
  const sampleDomain = (): KuDetailsDomainEntity =>
    new KuDetailsDomainEntity({
      id: 42,
      coopname: 'voskhod',
      coreBraname: 'voskhod1',
      geocodedAddress: 'г. Москва, ул. Тверская, 1',
      workingHours: {
        mon: { open: '09:00', close: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
        sat: { open: '10:00', close: '14:00', breaks: [] },
      },
      description: 'Главный ПВЗ',
      status: 'ACTIVE',
      lat: 55.755826,
      lng: 37.617299,
      geocodeStatus: 'OK',
      geocodedAt: new Date('2026-05-14T10:00:00Z'),
      createdAt: new Date('2026-05-14T09:00:00Z'),
      updatedAt: new Date('2026-05-14T09:30:00Z'),
    });

  it('toEntity сохраняет все поля', () => {
    const domain = sampleDomain();
    const entity = KuDetailsMapper.toEntity(domain);

    expect(entity.id).toBe(42);
    expect(entity.coopname).toBe('voskhod');
    expect(entity.coreBraname).toBe('voskhod1');
    expect(entity.geocodedAddress).toBe('г. Москва, ул. Тверская, 1');
    expect(entity.workingHoursJson.mon?.open).toBe('09:00');
    expect(entity.workingHoursJson.mon?.breaks[0]?.start).toBe('13:00');
    expect(entity.description).toBe('Главный ПВЗ');
    expect(entity.status).toBe('ACTIVE');
    expect(entity.lat).toBeCloseTo(55.755826, 5);
    expect(entity.lng).toBeCloseTo(37.617299, 5);
    expect(entity.geocodeStatus).toBe('OK');
    expect(entity.geocodeErrorMessage).toBeUndefined();
    expect(entity.geocodedAt?.toISOString()).toBe('2026-05-14T10:00:00.000Z');
  });

  it('toDomain поднимает все поля обратно (round-trip)', () => {
    const original = sampleDomain();
    const entity = KuDetailsMapper.toEntity(original);
    const back = KuDetailsMapper.toDomain(entity);

    expect(back.coopname).toBe(original.coopname);
    expect(back.coreBraname).toBe(original.coreBraname);
    expect(back.geocodedAddress).toBe(original.geocodedAddress);
    expect(back.workingHours).toEqual(original.workingHours);
    expect(back.description).toBe(original.description);
    expect(back.status).toBe(original.status);
    expect(back.lat).toBeCloseTo(original.lat!, 5);
    expect(back.lng).toBeCloseTo(original.lng!, 5);
    expect(back.geocodeStatus).toBe(original.geocodeStatus);
    expect(back.createdAt.toISOString()).toBe(original.createdAt.toISOString());
  });

  it('toDomain переводит nullable поля entity в undefined в domain', () => {
    const entity = new KuDetailsTypeormEntity();
    entity.id = 1;
    entity.coopname = 'voskhod';
    entity.coreBraname = 'voskhod2';
    entity.geocodedAddress = undefined;
    entity.workingHoursJson = {};
    entity.status = 'INACTIVE';
    entity.geocodeStatus = 'PENDING';
    entity.createdAt = new Date('2026-05-14T00:00:00Z');
    entity.updatedAt = new Date('2026-05-14T00:00:00Z');

    const domain = KuDetailsMapper.toDomain(entity);

    expect(domain.lat).toBeUndefined();
    expect(domain.lng).toBeUndefined();
    expect(domain.description).toBeUndefined();
    expect(domain.geocodedAt).toBeUndefined();
    expect(domain.geocodeErrorMessage).toBeUndefined();
    expect(domain.status).toBe('INACTIVE');
    expect(domain.geocodeStatus).toBe('PENDING');
  });
});
