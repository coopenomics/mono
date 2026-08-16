import { Ndfl6DataService } from '../../../src/extensions/reports/domain/services/ndfl6-data.service';
import type { Ledger2OperationDTO } from '../../../src/application/ledger2/dto/ledger2-operation.dto';
import type { IndividualDomainInterface } from '../../../src/domain/common/interfaces/individual-domain.interface';

/**
 * Расчёт 6-НДФЛ по данным ledger2.
 *
 * Проверяем то, что нельзя увидеть в XML-генераторе: как выплата и удержание
 * склеиваются в доход до налога, как удержания раскладываются по шести срокам
 * перечисления и что происходит на границах — суток по московскому времени,
 * квартала и года.
 */

const COOPNAME = 'voskhod';

let sequence = 0;

/**
 * Операция ledger2. Дата задаётся московским временем — так же, как её видит
 * бухгалтер; в UTC переводим здесь, потому что блокчейн штампует блоки в UTC.
 */
function operation(params: {
  code: 'o.brn.aid' | 'o.brn.aidtax';
  username: string;
  amount: string;
  moscow: { year: number; month: number; day: number; hour?: number; minute?: number };
  hash?: string | null;
}): Ledger2OperationDTO {
  const { year, month, day, hour = 12, minute = 0 } = params.moscow;
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - 3 * 60 * 60 * 1000;
  sequence += 1;
  return {
    globalSequence: String(sequence),
    blockNum: sequence,
    coopname: COOPNAME,
    action: 'apply',
    operationCode: params.code,
    processHash: params.hash === undefined ? 'hash-default' : params.hash,
    username: params.username,
    quantity: params.amount,
    createdAt: new Date(utcMillis),
  } as Ledger2OperationDTO;
}

/** Пара проводок одной выплаты: на руки и удержанный налог. */
function payout(params: {
  username: string;
  net: string;
  tax?: string;
  moscow: { year: number; month: number; day: number; hour?: number; minute?: number };
  hash: string;
}): Ledger2OperationDTO[] {
  const ops = [
    operation({
      code: 'o.brn.aid',
      username: params.username,
      amount: params.net,
      moscow: params.moscow,
      hash: params.hash,
    }),
  ];
  if (params.tax) {
    ops.push(
      operation({
        code: 'o.brn.aidtax',
        username: params.username,
        amount: params.tax,
        moscow: params.moscow,
        hash: params.hash,
      }),
    );
  }
  return ops;
}

function makeService(
  operations: Ledger2OperationDTO[],
  individuals: Record<string, IndividualDomainInterface> = {},
): Ndfl6DataService {
  const ledger2 = {
    getHistory: jest.fn().mockResolvedValue({
      items: operations,
      totalCount: operations.length,
      totalPages: 1,
      currentPage: 1,
    }),
  };
  const individualRepo = {
    findByUsername: jest.fn(async (username: string) => {
      const found = individuals[username];
      if (!found) throw new Error(`Физлицо ${username} не найдено`);
      return found;
    }),
    create: jest.fn(),
  };
  return new Ndfl6DataService(ledger2 as never, individualRepo as never);
}

const IVANOV: IndividualDomainInterface = {
  username: 'ivanovivan11',
  first_name: 'Иван',
  last_name: 'Иванов',
  middle_name: 'Иванович',
  birthdate: '1980/01/15',
  full_address: 'Москва',
  phone: '79001234567',
  email: 'ivanov@example.com',
  passport: {
    series: 405,
    number: 123456,
    issued_by: 'ОВД',
    issued_at: '2000-01-01',
    code: '770-001',
  },
};

beforeEach(() => {
  sequence = 0;
});

describe('Ndfl6DataService — разделы 1 и 2', () => {
  it('доход считается до удержания: выплата на руки плюс налог', async () => {
    // Заявление на 10 000 ₽: получатель получил 8 700 ₽, 1 300 ₽ удержано.
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 15 },
        hash: 'aid-1',
      }),
    );

    const tax = await service.buildTaxSection(COOPNAME, 2026, 1);

    expect(tax.incomeTotal).toBe(10000);
    expect(tax.taxBase).toBe(10000);
    expect(tax.taxCalculated).toBe(1300);
    expect(tax.withheldTotal).toBe(1300);
    expect(tax.peopleCount).toBe(1);
    expect(tax.deductionsTotal).toBe(0);
  });

  it('выплата без удержания попадает в доход целиком', async () => {
    // Налог меньше рубля округляется в ноль, и контракт проводку не делает —
    // доход при этом всё равно получен и должен попасть в отчёт.
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '3.0000 RUB',
        moscow: { year: 2026, month: 2, day: 10 },
        hash: 'aid-small',
      }),
    );

    const tax = await service.buildTaxSection(COOPNAME, 2026, 1);

    expect(tax.incomeTotal).toBe(3);
    expect(tax.withheldTotal).toBe(0);
    expect(tax.peopleCount).toBe(1);
  });

  it('копейки не теряются при сложении выплаты и налога', async () => {
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '8700.5500 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 1 },
        hash: 'aid-kop',
      }),
    );

    const tax = await service.buildTaxSection(COOPNAME, 2026, 1);

    expect(tax.incomeTotal).toBeCloseTo(10000.55, 2);
  });

  it('число физлиц считает уникальных получателей, а не выплаты', async () => {
    const service = makeService([
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 1, day: 10 },
        hash: 'aid-1',
      }),
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 2, day: 10 },
        hash: 'aid-2',
      }),
      ...payout({
        username: 'petrovpetr11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 10 },
        hash: 'aid-3',
      }),
    ]);

    const tax = await service.buildTaxSection(COOPNAME, 2026, 1);

    expect(tax.peopleCount).toBe(2);
    expect(tax.withheldTotal).toBe(3900);
  });
});

describe('Ndfl6DataService — шесть сроков перечисления', () => {
  const june22 = { year: 2026, month: 6, day: 22 };
  const june23 = { year: 2026, month: 6, day: 23 };

  it('до 22-го числа включительно — первый срок месяца, с 23-го — второй', async () => {
    const service = makeService([
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: june22,
        hash: 'aid-22',
      }),
      ...payout({
        username: 'petrovpetr11',
        net: '8700.0000 RUB',
        tax: '1950.0000 RUB',
        moscow: june23,
        hash: 'aid-23',
      }),
    ]);

    // Июнь — третий месяц второго квартала, значит пятый и шестой сроки.
    const tax = await service.buildTaxSection(COOPNAME, 2026, 2);

    expect(tax.byTerm).toEqual([0, 0, 0, 0, 1300, 1950]);
  });

  it('срок определяется по московскому времени, а не по UTC', async () => {
    // 23 июня 01:00 по Москве — это ещё 22 июня 22:00 в UTC. Без перевода
    // в московское время удержание уехало бы в предыдущий срок.
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { ...june23, hour: 1 },
        hash: 'aid-msk',
      }),
    );

    const tax = await service.buildTaxSection(COOPNAME, 2026, 2);

    expect(tax.byTerm).toEqual([0, 0, 0, 0, 0, 1300]);
  });

  it('итог идёт с начала года, а сроки — только за последний квартал', async () => {
    const service = makeService([
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 2, day: 10 },
        hash: 'aid-feb',
      }),
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1950.0000 RUB',
        moscow: { year: 2026, month: 5, day: 10 },
        hash: 'aid-may',
      }),
    ]);

    const tax = await service.buildTaxSection(COOPNAME, 2026, 2);

    // Февральское удержание входит в нарастающий итог, но в разбивку по
    // срокам второго квартала не попадает.
    expect(tax.withheldTotal).toBe(3250);
    expect(tax.byTerm).toEqual([0, 0, 1950, 0, 0, 0]);
  });

  it('выплаты после отчётного квартала не учитываются', async () => {
    const service = makeService([
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 10 },
        hash: 'aid-q1',
      }),
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1950.0000 RUB',
        moscow: { year: 2026, month: 4, day: 10 },
        hash: 'aid-q2',
      }),
    ]);

    const tax = await service.buildTaxSection(COOPNAME, 2026, 1);

    expect(tax.withheldTotal).toBe(1300);
  });

  it('выплаты соседнего года не попадают в отчёт', async () => {
    const service = makeService([
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2025, month: 12, day: 31, hour: 23 },
        hash: 'aid-prev',
      }),
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1950.0000 RUB',
        moscow: { year: 2026, month: 1, day: 1, hour: 1 },
        hash: 'aid-cur',
      }),
    ]);

    const tax = await service.buildTaxSection(COOPNAME, 2026, 1);

    expect(tax.withheldTotal).toBe(1950);
    expect(tax.byTerm).toEqual([1950, 0, 0, 0, 0, 0]);
  });
});

describe('Ndfl6DataService — периоды уведомления об исчисленных суммах', () => {
  it('удержания раскладываются по расчётным периодам месяца', async () => {
    const service = makeService([
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 15 },
        hash: 'aid-first-half',
      }),
      ...payout({
        username: 'petrovpetr11',
        net: '8700.0000 RUB',
        tax: '1950.0000 RUB',
        moscow: { year: 2026, month: 3, day: 25 },
        hash: 'aid-second-half',
      }),
    ]);

    const amounts = await service.buildNotificationAmounts(COOPNAME, 2026);

    // Март — третий месяц: периоды 5 (1–22) и 6 (23–конец).
    expect(amounts.get(5)).toBe(1300);
    expect(amounts.get(6)).toBe(1950);
  });

  it('периоды без удержаний в карту не попадают — подавать за них нечего', async () => {
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 15 },
        hash: 'aid-1',
      }),
    );

    const amounts = await service.buildNotificationAmounts(COOPNAME, 2026);

    expect(amounts.size).toBe(1);
    expect(amounts.has(1)).toBe(false);
    expect(amounts.has(6)).toBe(false);
  });

  it('выплата без удержания не создаёт периода', async () => {
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '3.0000 RUB',
        moscow: { year: 2026, month: 3, day: 15 },
        hash: 'aid-small',
      }),
    );

    expect((await service.buildNotificationAmounts(COOPNAME, 2026)).size).toBe(0);
  });

  it('несколько выплат в одном периоде складываются', async () => {
    const service = makeService([
      ...payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 7, day: 5 },
        hash: 'aid-a',
      }),
      ...payout({
        username: 'petrovpetr11',
        net: '8700.0000 RUB',
        tax: '1950.0000 RUB',
        moscow: { year: 2026, month: 7, day: 20 },
        hash: 'aid-b',
      }),
    ]);

    // Июль — седьмой месяц: первый расчётный период имеет номер 13.
    expect((await service.buildNotificationAmounts(COOPNAME, 2026)).get(13)).toBe(3250);
  });

  it('сумма за конкретный период совпадает с картой', async () => {
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 12, day: 28 },
        hash: 'aid-dec',
      }),
    );

    expect(await service.buildNotificationAmount(COOPNAME, 2026, 12, true)).toBe(1300);
    expect(await service.buildNotificationAmount(COOPNAME, 2026, 12, false)).toBe(0);
  });
});

describe('Ndfl6DataService — справки о доходах', () => {
  it('справка собирает годовой доход и помесячную разбивку', async () => {
    const service = makeService(
      [
        ...payout({
          username: 'ivanovivan11',
          net: '8700.0000 RUB',
          tax: '1300.0000 RUB',
          moscow: { year: 2026, month: 3, day: 15 },
          hash: 'aid-mar',
        }),
        ...payout({
          username: 'ivanovivan11',
          net: '17400.0000 RUB',
          tax: '2600.0000 RUB',
          moscow: { year: 2026, month: 9, day: 5 },
          hash: 'aid-sep',
        }),
      ],
      { ivanovivan11: IVANOV },
    );

    const [certificate] = await service.buildCertificates(COOPNAME, 2026);

    expect(certificate.incomeTotal).toBe(30000);
    expect(certificate.taxWithheld).toBe(3900);
    expect(certificate.monthlyIncome).toEqual([
      { month: 3, incomeCode: '2710', amount: 10000 },
      { month: 9, incomeCode: '2710', amount: 20000 },
    ]);
  });

  it('персональные данные берутся из профиля пайщика', async () => {
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 15 },
        hash: 'aid-1',
      }),
      { ivanovivan11: IVANOV },
    );

    const [certificate] = await service.buildCertificates(COOPNAME, 2026);

    expect(certificate.lastName).toBe('Иванов');
    expect(certificate.firstName).toBe('Иван');
    expect(certificate.middleName).toBe('Иванович');
    expect(certificate.birthDate).toBe('15.01.1980');
    expect(certificate.taxpayerStatus).toBe('1');
    expect(certificate.citizenshipCode).toBe('643');
    expect(certificate.documentTypeCode).toBe('21');
  });

  it('ведущий ноль серии паспорта восстанавливается', async () => {
    // Серия и номер хранятся числами, поэтому «0405» лежит в базе как 405 —
    // без дополнения нулями в справку уехал бы несуществующий документ.
    const service = makeService(
      payout({
        username: 'ivanovivan11',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 15 },
        hash: 'aid-1',
      }),
      { ivanovivan11: IVANOV },
    );

    const [certificate] = await service.buildCertificates(COOPNAME, 2026);

    expect(certificate.documentSerialNumber).toBe('0405 123456');
  });

  it('справки нумеруются подряд и устойчиво по получателям', async () => {
    const service = makeService(
      [
        ...payout({
          username: 'petrovpetr11',
          net: '8700.0000 RUB',
          tax: '1300.0000 RUB',
          moscow: { year: 2026, month: 3, day: 15 },
          hash: 'aid-p',
        }),
        ...payout({
          username: 'ivanovivan11',
          net: '8700.0000 RUB',
          tax: '1300.0000 RUB',
          moscow: { year: 2026, month: 4, day: 15 },
          hash: 'aid-i',
        }),
      ],
      { ivanovivan11: IVANOV },
    );

    const certificates = await service.buildCertificates(COOPNAME, 2026);

    expect(certificates.map((c) => c.username)).toEqual(['ivanovivan11', 'petrovpetr11']);
    expect(certificates.map((c) => c.number)).toEqual([1, 2]);
    expect(certificates.every((c) => c.correctionNumber === '00')).toBe(true);
  });

  it('отсутствие профиля не роняет отчёт — справка выходит с пустыми полями', async () => {
    const service = makeService(
      payout({
        username: 'unknownuser1',
        net: '8700.0000 RUB',
        tax: '1300.0000 RUB',
        moscow: { year: 2026, month: 3, day: 15 },
        hash: 'aid-1',
      }),
    );

    const [certificate] = await service.buildCertificates(COOPNAME, 2026);

    expect(certificate.lastName).toBe('');
    expect(certificate.documentSerialNumber).toBe('');
    expect(certificate.taxWithheld).toBe(1300);
  });

  it('без выплат справок нет', async () => {
    const service = makeService([]);
    expect(await service.buildCertificates(COOPNAME, 2026)).toEqual([]);
  });
});
