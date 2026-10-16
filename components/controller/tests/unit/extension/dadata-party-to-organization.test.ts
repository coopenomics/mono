/**
 * Перевод карточки организации DaData в поля анкеты вступления.
 *
 * Что здесь защищается. Поле, которое DaData знает, ложится в своё поле
 * анкеты; поле, которого нет, остаётся пустым — его заполнит пайщик. Тип
 * организации распознаётся только для трёх типов анкеты, прочие формы пайщик
 * выбирает сам. Ответ сверен с живой карточкой ПК «ВОСХОД» 16.10.2026,
 * данные в фикстуре вымышленные.
 *
 * Реестр случаев: test-registry/registration.organization-lookup.yaml
 */

import { InnerOrganizationType } from '@coopenomics/innercoop';
import {
  organizationTypeByOkopf,
  partyToEntrepreneur,
  partyToOrganization,
  sentenceCase,
  splitFullName,
  type DadataParty,
} from '~/extensions/dadata/domain/party-to-organization';

const PARTY: DadataParty = {
  inn: '7700000000',
  ogrn: '1247700000000',
  kpp: '770001001',
  name: { full_with_opf: 'ПОТРЕБИТЕЛЬСКИЙ КООПЕРАТИВ "РОМАШКА"', short_with_opf: 'ПК "РОМАШКА"' },
  opf: { code: '20100' },
  management: { name: 'Иванов Иван Иванович', post: 'ПРЕДСЕДАТЕЛЬ СОВЕТА' },
  address: {
    value: 'г Москва, ул Луговая, д 1',
    unrestricted_value: '117000, г Москва, ул Луговая, д 1',
    data: { city: 'Москва', settlement: null, region: 'Москва' },
  },
};

describe('partyToOrganization', () => {
  it('раскладывает карточку по полям анкеты', () => {
    expect(partyToOrganization(PARTY, '7700000000')).toEqual({
      short_name: 'ПК "РОМАШКА"',
      full_name: 'ПОТРЕБИТЕЛЬСКИЙ КООПЕРАТИВ "РОМАШКА"',
      type: InnerOrganizationType.COOP,
      represented_by: {
        last_name: 'Иванов',
        first_name: 'Иван',
        middle_name: 'Иванович',
        position: 'Председатель совета',
      },
      city: 'Москва',
      full_address: '117000, г Москва, ул Луговая, д 1',
      details: { inn: '7700000000', ogrn: '1247700000000', kpp: '770001001' },
    });
  });

  it('без руководителя и адреса эти поля остаются пайщику', () => {
    const result = partyToOrganization({ inn: '7700000000', management: null, address: null }, '7700000000');

    expect(result.represented_by).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.full_address).toBeUndefined();
    expect(result.details).toEqual({ inn: '7700000000', ogrn: undefined, kpp: undefined });
  });

  it('город берётся из населённого пункта, если города в адресе нет', () => {
    const result = partyToOrganization(
      { ...PARTY, address: { value: 'п Лесной', data: { city: null, settlement: 'Лесной', region: 'Московская' } } },
      '7700000000'
    );

    expect(result.city).toBe('Лесной');
    expect(result.full_address).toBe('п Лесной');
  });

  it('ИНН берётся из запроса, если DaData его не вернула', () => {
    expect(partyToOrganization({ ...PARTY, inn: null }, '7700000000').details.inn).toBe('7700000000');
  });
});

describe('organizationTypeByOkopf', () => {
  it.each([
    ['20100', InnerOrganizationType.COOP],
    ['20107', InnerOrganizationType.COOP],
    ['14000', InnerOrganizationType.PRODCOOP],
    ['14100', InnerOrganizationType.PRODCOOP],
    ['12300', InnerOrganizationType.OOO],
  ])('код %s — тип анкеты', (code, type) => {
    expect(organizationTypeByOkopf(code)).toBe(type);
  });

  it.each([['12267'], ['20700'], [''], [null]])('код %s анкета не знает — тип выбирает пайщик', (code) => {
    expect(organizationTypeByOkopf(code)).toBeUndefined();
  });
});

describe('sentenceCase и splitFullName', () => {
  it('должность из прописных — с заглавной буквы', () => {
    expect(sentenceCase('ПРЕДСЕДАТЕЛЬ СОВЕТА')).toBe('Председатель совета');
    expect(sentenceCase('  ')).toBeUndefined();
  });

  it('хвост имени из нескольких слов уходит в отчество', () => {
    expect(splitFullName('Алиев Рашид Ахмед Оглы')).toEqual({
      last_name: 'Алиев',
      first_name: 'Рашид',
      middle_name: 'Ахмед Оглы',
    });
    expect(splitFullName('Иванов Иван')).toEqual({ last_name: 'Иванов', first_name: 'Иван', middle_name: undefined });
  });
});

describe('partyToEntrepreneur', () => {
  const IP: DadataParty = {
    inn: '770000000001',
    ogrn: '324770000000001',
    fio: { surname: 'Петров', name: 'Сергей', patronymic: 'Николаевич' },
    address: { value: 'г Москва', unrestricted_value: '101000, г Москва', data: { city: 'Москва', region: 'Москва' } },
  };

  it('раскладывает карточку ИП: ФИО по частям, ИНН, ОГРНИП, город', () => {
    expect(partyToEntrepreneur(IP, '770000000001')).toEqual({
      last_name: 'Петров',
      first_name: 'Сергей',
      middle_name: 'Николаевич',
      city: 'Москва',
      details: { inn: '770000000001', ogrn: '324770000000001' },
    });
  });

  it('адрес не переносится: реестр ИП публикует только индекс и город', () => {
    expect(partyToEntrepreneur(IP, '770000000001')).not.toHaveProperty('full_address');
  });

  it('без отчества в реестре поле отчества пусто', () => {
    const result = partyToEntrepreneur({ ...IP, fio: { surname: 'Петров', name: 'Сергей', patronymic: null } }, '770000000001');
    expect(result.middle_name).toBeUndefined();
  });

  it('регион городом не считается', () => {
    const result = partyToEntrepreneur(
      { ...IP, address: { value: 'Московская обл', data: { city: null, settlement: null, region: 'Московская' } } },
      '770000000001'
    );
    expect(result.city).toBeUndefined();
  });
});
