/**
 * Анкетные данные пайщика приходят без разметки.
 *
 * Данные подставляются в документ, а шаблоны собираются с выключенным
 * автоэкранированием — значит фамилия или адрес с угловыми скобками сами
 * становятся разметкой и уезжают в подписываемый документ, в реестр и на стол
 * совета. До 17.09.2026 сервер принимал здесь любую строку: браузерное
 * правило покрывало одни ФИО, а мутация — ни одного поля.
 *
 * Проверяется и то, что обычные имена и адреса по-прежнему проходят: правило
 * запрещает ровно две скобки, а не «всё непривычное».
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIndividualDataInputDTO } from '~/application/account/dto/create-individual-data-input.dto';
import { CreateEntrepreneurDataInputDTO } from '~/application/account/dto/create-entrepreneur-data-input.dto';
import { CreateOrganizationDataInputDTO } from '~/application/account/dto/create-organization-data-input.dto';

const individual = () => ({
  first_name: 'Иван',
  last_name: 'Иванов',
  middle_name: 'Иванович',
  birthdate: '1980-01-01',
  full_address: 'г. Москва, ул. Ленина, д. 1, кв. 2',
  phone: '+79000000000',
  email: 'ivan@example.com',
  passport: { code: '770-001', issued_at: '2010-01-01', issued_by: 'ОВД Москвы', series: 4500, number: 123456 },
});

const entrepreneur = () => ({
  first_name: 'Пётр',
  last_name: 'Петров',
  middle_name: 'Петрович',
  birthdate: '1975-05-05',
  city: 'Казань',
  country: 'Российская Федерация',
  full_address: 'г. Казань, ул. Баумана, д. 3',
  phone: '+79110000000',
  email: 'petr@example.com',
  details: { inn: '1655000000', ogrn: '1021600000000' },
  bank_account: {
    currency: 'RUB',
    bank_name: 'АК БАРС',
    account_number: '40802810000000000001',
    details: { bik: '049205805', corr: '30101810000000000805' },
  },
});

const organization = () => ({
  type: 'coop',
  short_name: 'ПК «Восход»',
  full_name: 'Потребительский кооператив «Восход»',
  city: 'Москва',
  country: 'Российская Федерация',
  full_address: 'г. Москва, ул. Тверская, д. 1',
  fact_address: 'г. Москва, ул. Тверская, д. 1',
  phone: '+74950000000',
  email: 'coop@example.com',
  details: { inn: '7700000000', kpp: '770001001', ogrn: '1027700000000' },
  represented_by: {
    first_name: 'Сергей',
    last_name: 'Сергеев',
    middle_name: 'Сергеевич',
    position: 'Председатель',
    based_on: 'Устава',
  },
  bank_account: {
    currency: 'RUB',
    bank_name: 'Сбербанк',
    account_number: '40703810000000000001',
    details: { bik: '044525225', corr: '30101810400000000225' },
  },
});

const errorsOf = async (cls: any, plain: Record<string, unknown>) =>
  validate(plainToInstance(cls, plain), { whitelist: false });

/** Собирает имена полей, на которых сработал запрет разметки, включая вложенные. */
const markupFields = (errors: any[], prefix = ''): string[] =>
  errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const own = error.constraints?.noMarkup ? [path] : [];
    return [...own, ...markupFields(error.children ?? [], path)];
  });

describe('анкетные данные без разметки', () => {
  it('обычные данные физлица принимаются', async () => {
    expect(await errorsOf(CreateIndividualDataInputDTO, individual())).toHaveLength(0);
  });

  it('фамилия с угловыми скобками отклоняется', async () => {
    const errors = await errorsOf(CreateIndividualDataInputDTO, {
      ...individual(),
      last_name: 'Иванов<img src=x onerror=alert(1)>',
    });
    expect(markupFields(errors)).toContain('last_name');
  });

  it('адрес с угловой скобкой отклоняется', async () => {
    const errors = await errorsOf(CreateIndividualDataInputDTO, {
      ...individual(),
      full_address: 'г. Москва, <script>alert(1)</script>',
    });
    expect(markupFields(errors)).toContain('full_address');
  });

  it('разметка в паспорте отклоняется — вложенные поля тоже проверяются', async () => {
    const data = individual();
    const errors = await errorsOf(CreateIndividualDataInputDTO, {
      ...data,
      passport: { ...data.passport, issued_by: 'ОВД <b>Москвы</b>' },
    });
    expect(markupFields(errors)).toContain('passport.issued_by');
  });

  it('разметка в банковских реквизитах предпринимателя отклоняется', async () => {
    const data = entrepreneur();
    const errors = await errorsOf(CreateEntrepreneurDataInputDTO, {
      ...data,
      bank_account: { ...data.bank_account, bank_name: '<b>АК БАРС</b>' },
    });
    expect(markupFields(errors)).toContain('bank_account.bank_name');
  });

  it('обычные данные предпринимателя и организации принимаются', async () => {
    expect(await errorsOf(CreateEntrepreneurDataInputDTO, entrepreneur())).toHaveLength(0);
    expect(await errorsOf(CreateOrganizationDataInputDTO, organization())).toHaveLength(0);
  });

  it('разметка в имени представителя организации отклоняется', async () => {
    const data = organization();
    const errors = await errorsOf(CreateOrganizationDataInputDTO, {
      ...data,
      represented_by: { ...data.represented_by, last_name: 'Сергеев<script>' },
    });
    expect(markupFields(errors)).toContain('represented_by.last_name');
  });

  it('привычные знаки в именах и названиях не мешают', async () => {
    const errors = await errorsOf(CreateIndividualDataInputDTO, {
      ...individual(),
      last_name: "О'Коннор-Иванов",
      full_address: 'г. Санкт-Петербург, наб. реки Фонтанки, д. 1/2, лит. А',
    });
    expect(errors).toHaveLength(0);
  });
});
