/**
 * Unit-тесты registrationProfileFingerprint (Гард A регистрации).
 *
 * Хелпер — «замок» консистентности: каноничный отпечаток удостоверяющих
 * личность данных пайщика, который фиксируется при подписании заявления и
 * сверяется перед регистрацией в блокчейне. Тесты проверяют:
 *   1. одинаковый профиль → одинаковый отпечаток;
 *   2. независимость от порядка ключей (детерминированная сериализация);
 *   3. изменение значимого поля → другой отпечаток;
 *   4. отсутствие профиля → null (grandfather: гард не срабатывает).
 */
import { registrationProfileFingerprint } from '~/utils/registration-profile-fingerprint';

const individual = {
  type: 'individual',
  individual_data: {
    username: 'ivanivanov',
    first_name: 'Иван',
    last_name: 'Иванов',
    middle_name: 'Иванович',
    birthdate: '1990-01-01',
    full_address: 'г. Москва, ул. Ленина, д. 1',
    phone: '+79990001122',
    email: 'ivan@example.com',
  },
};

describe('registrationProfileFingerprint', () => {
  it('одинаковый профиль → одинаковый отпечаток', () => {
    const a = registrationProfileFingerprint(individual);
    const b = registrationProfileFingerprint(JSON.parse(JSON.stringify(individual)));
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it('не зависит от порядка ключей', () => {
    const reordered = {
      individual_data: {
        email: 'ivan@example.com',
        phone: '+79990001122',
        last_name: 'Иванов',
        first_name: 'Иван',
        full_address: 'г. Москва, ул. Ленина, д. 1',
        birthdate: '1990-01-01',
        middle_name: 'Иванович',
      },
      type: 'individual',
    };
    expect(registrationProfileFingerprint(reordered)).toBe(
      registrationProfileFingerprint(individual)
    );
  });

  it('игнорирует служебные/волатильные поля вне whitelist', () => {
    const withNoise = {
      type: 'individual',
      individual_data: {
        ...individual.individual_data,
        id: 42,
        updated_at: '2026-06-05T00:00:00.000Z',
        is_registered: true,
      },
    };
    expect(registrationProfileFingerprint(withNoise)).toBe(
      registrationProfileFingerprint(individual)
    );
  });

  it('изменение значимого поля → другой отпечаток', () => {
    const changed = {
      type: 'individual',
      individual_data: { ...individual.individual_data, last_name: 'Петров' },
    };
    expect(registrationProfileFingerprint(changed)).not.toBe(
      registrationProfileFingerprint(individual)
    );
  });

  it('нет профиля → null (grandfather)', () => {
    expect(registrationProfileFingerprint(null)).toBeNull();
    expect(registrationProfileFingerprint({})).toBeNull();
    expect(registrationProfileFingerprint({ type: 'individual' })).toBeNull();
  });

  it('предприниматель и организация дают непустой отпечаток', () => {
    const entrepreneur = {
      type: 'entrepreneur',
      entrepreneur_data: {
        first_name: 'Пётр',
        last_name: 'Петров',
        middle_name: 'Петрович',
        birthdate: '1985-05-05',
        phone: '+79993334455',
        email: 'petr@example.com',
        country: 'Россия',
        city: 'Москва',
        full_address: 'г. Москва, ул. Мира, д. 2',
        details: { inn: '770000000000', ogrn: '300000000000000' },
      },
    };
    const organization = {
      type: 'organization',
      organization_data: {
        type: 'COOP',
        short_name: 'ТестКооп',
        full_name: 'Тестовый Кооператив',
        represented_by: { first_name: 'Иван', last_name: 'Иванов', position: 'Председатель' },
        country: 'Россия',
        city: 'Москва',
        full_address: 'г. Москва, ул. Садовая, д. 3',
        fact_address: 'г. Москва, ул. Садовая, д. 3',
        phone: '+74950001122',
        email: 'coop@example.com',
        details: { inn: '7700000001', kpp: '770001001', ogrn: '1027700000000' },
      },
    };
    expect(registrationProfileFingerprint(entrepreneur)).toBeTruthy();
    expect(registrationProfileFingerprint(organization)).toBeTruthy();
    expect(registrationProfileFingerprint(entrepreneur)).not.toBe(
      registrationProfileFingerprint(organization)
    );
  });
});
