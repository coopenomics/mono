import { createHash } from 'node:crypto';
import { InnerAccountType } from '@coopenomics/innercoop';
import { CardcoopIdentityService } from '~/extensions/cardcoop/identity/identity.service';

/**
 * Отпечатки реквизитов для подтверждения членства (story 7.7).
 *
 * Главное, что здесь проверяется: значения не канонизируются. Отпечаток обязан
 * различать паспортное написание, иначе ошибка ввода в одном кооперативе
 * останется невидимой — а ради её обнаружения весь механизм и заводится.
 */
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

const individual = {
  username: 'ant',
  first_name: 'Пётр',
  last_name: 'Муравьёв',
  middle_name: 'Иванович',
  birthdate: '1980-05-01',
  full_address: 'г. Москва, ул. Мира, д. 1',
  phone: '+79001112233',
  email: 'ant@example.org',
  passport: { series: 4510, number: 123456, issued_by: 'ОВД Тверское', issued_at: '2005-06-01', code: '770-001' },
};

const organization = {
  username: 'voskhod',
  type: 'coop',
  short_name: 'ПК «ВОСХОД»',
  full_name: 'Потребительский кооператив «ВОСХОД»',
  represented_by: { first_name: 'Иван', last_name: 'Иванов', middle_name: 'Иванович', position: 'Председатель', based_on: 'Устав' },
  country: 'Россия',
  city: 'Москва',
  full_address: 'г. Москва, ул. Мира, д. 1',
  fact_address: 'г. Москва, ул. Мира, д. 1',
  phone: '+74951112233',
  email: 'coop@example.org',
  details: { inn: '7701234567', ogrn: '1157700000000', kpp: '770101001' },
};

const buildService = (account: any, card: any) =>
  new CardcoopIdentityService(
    { getAccount: async () => account } as any,
    { findByUsername: async () => card } as any,
    { findByUsername: async () => card } as any
  );

const individualAccount = { private_account: { type: InnerAccountType.individual } };
const organizationAccount = { private_account: { type: InnerAccountType.organization } };

describe('Отпечатки реквизитов пайщика для card.coop', () => {
  it('ФИО уходит открыто, остальные поля — отпечатками', async () => {
    const block = await buildService(individualAccount, individual).build('ant');

    expect(block.kind).toBe(InnerAccountType.individual);
    expect(block.public).toEqual({ last_name: 'Муравьёв', first_name: 'Пётр', middle_name: 'Иванович' });

    // Ни одного значения в открытом виде — только их отпечатки.
    expect(block.digests.birthdate).toBe(sha('1980-05-01'));
    expect(block.digests.email).toBe(sha('ant@example.org'));
    expect(Object.values(block.digests)).not.toContain('1980-05-01');
  });

  it('паспорт разложен по полям — расходящееся поле можно назвать по имени', async () => {
    const block = await buildService(individualAccount, individual).build('ant');

    expect(block.digests['passport.series']).toBe(sha('4510'));
    expect(block.digests['passport.number']).toBe(sha('123456'));
    expect(block.digests['passport.issued_by']).toBe(sha('ОВД Тверское'));
    expect(block.digests['passport.code']).toBe(sha('770-001'));
  });

  it('«ё» и «е» дают РАЗНЫЕ отпечатки — иначе ошибка ввода осталась бы невидимой', async () => {
    const withYo = await buildService(individualAccount, {
      ...individual,
      full_address: 'г. Королёв, ул. Мира, д. 1',
    }).build('ant');
    const withoutYo = await buildService(individualAccount, {
      ...individual,
      full_address: 'г. Королев, ул. Мира, д. 1',
    }).build('ant');

    expect(withYo.digests.full_address).not.toBe(withoutYo.digests.full_address);
    expect(withYo.digests.full_address).toBe(sha('г. Королёв, ул. Мира, д. 1'));
  });

  it('регистр и лишний пробел меняют отпечаток — значения не приводятся к канону', async () => {
    const base = await buildService(individualAccount, individual).build('ant');
    const upper = await buildService(individualAccount, { ...individual, email: 'ANT@example.org' }).build('ant');
    const spaced = await buildService(individualAccount, { ...individual, email: ' ant@example.org' }).build('ant');

    expect(upper.digests.email).not.toBe(base.digests.email);
    expect(spaced.digests.email).not.toBe(base.digests.email);
  });

  it('незаполненное поле в отпечатки не попадает — сверяется пересечение', async () => {
    const { passport, ...withoutPassport } = individual;
    const block = await buildService(individualAccount, withoutPassport).build('ant');

    expect(block.digests['passport.series']).toBeUndefined();
    expect(block.digests.birthdate).toBe(sha('1980-05-01'));

    const emptyEmail = await buildService(individualAccount, { ...individual, email: '' }).build('ant');
    expect(emptyEmail.digests.email).toBeUndefined();
  });

  it('у организации открыто наименование, реквизиты — отпечатками', async () => {
    const block = await buildService(organizationAccount, organization).build('voskhod');

    expect(block.kind).toBe(InnerAccountType.organization);
    expect(block.public).toEqual({ short_name: 'ПК «ВОСХОД»', full_name: 'Потребительский кооператив «ВОСХОД»' });
    expect(block.digests['details.inn']).toBe(sha('7701234567'));
    expect(block.digests['details.kpp']).toBe(sha('770101001'));
    expect(block.digests['represented_by.last_name']).toBe(sha('Иванов'));
    expect(block.digests['details.ogrn']).not.toBe('1157700000000');
  });

  it('ФИО в отпечатки не дублируется — оно и так открыто', async () => {
    const block = await buildService(individualAccount, individual).build('ant');

    expect(block.digests.first_name).toBeUndefined();
    expect(block.digests.last_name).toBeUndefined();
    expect(block.digests.middle_name).toBeUndefined();
  });

  it('пайщик без анкеты подтверждению не подлежит', async () => {
    const service = buildService({ private_account: null }, individual);

    await expect(service.build('ant')).rejects.toThrow(/Анкета пайщика/);
  });
});

/**
 * Анкета целиком — для выдачи по гранту раскрытия (story 7.8).
 *
 * Это единственный случай, когда данные уходят значениями, а не отпечатками, и происходит он
 * только по согласию держателя. Проверяем ровно две вещи: состав не урезан (иначе получателю
 * пришлось бы добирать поля руками — тем самым способом, который и порождает расхождения) и
 * внутреннее учётное имя наружу не уходит.
 */
describe('Анкета пайщика для раскрытия', () => {
  it('уходит значениями и в полном составе', async () => {
    const { kind, data } = await buildService(individualAccount, individual).profile('ant');

    expect(kind).toBe(InnerAccountType.individual);
    expect(data.last_name).toBe('Муравьёв');
    expect(data.birthdate).toBe('1980-05-01');
    expect(data.full_address).toBe('г. Москва, ул. Мира, д. 1');
    expect(data.passport).toEqual(individual.passport);
  });

  it('учётное имя пайщика в нашем кооперативе наружу не уходит', async () => {
    const { data } = await buildService(individualAccount, individual).profile('ant');

    expect(data.username).toBeUndefined();
    // Исходная карточка при этом не портится: она читается и другими потребителями.
    expect(individual.username).toBe('ant');
  });

  it('организация раскрывается своими реквизитами', async () => {
    const { kind, data } = await buildService(organizationAccount, organization).profile('voskhod');

    expect(kind).toBe(InnerAccountType.organization);
    expect(data.full_name).toBe('Потребительский кооператив «ВОСХОД»');
    expect(data.details).toEqual(organization.details);
    expect(data.username).toBeUndefined();
  });

  it('пайщик без анкеты раскрытию не подлежит', async () => {
    const service = buildService({ private_account: null }, individual);

    await expect(service.profile('ant')).rejects.toThrow(/Анкета пайщика/);
  });
});
