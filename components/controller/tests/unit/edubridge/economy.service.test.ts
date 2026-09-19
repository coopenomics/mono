/** Экономика курса: себестоимость из часов по ставке, наценка кооператива, годовая скидка, план и факт. */
import { EdubridgeEconomyService } from '~/extensions/edubridge/application/services/edubridge-economy.service';
import { calculateCourseFee, maxYearDiscountPercent } from '~/extensions/edubridge/domain/economy/course-fee.calculator';
import { EduAssignmentStatus, EduContractStatus } from '~/extensions/edubridge/domain/enums';

const COURSE_ID = '0cd16d12-6ade-40f2-8830-b0673dde8b9e';

/** Курс: восемь занятий в месяц по часу, плановая ставка 1000 ₽/ч, без годовой скидки. */
const COURSE = {
  id: COURSE_ID,
  lessons_per_month: 8,
  lessons_total: 64,
  lesson_minutes: 60,
  planned_hourly_rate: '1000.0000 RUB',
  year_discount_bp: 0,
  fee_month: '9600.0000 RUB',
  fee_year: '115200.0000 RUB',
} as any;

function make(
  options: {
    markup?: number;
    assignments?: any[];
    contracts?: any[];
    course?: any;
    coopWallets?: any[];
    memberShares?: any[];
    history?: any[];
  } = {}
) {
  const config = {
    load: jest.fn(async () => ({ markup_percent: options.markup ?? 20 })),
    set: jest.fn(),
  } as any;
  const courses = { findById: jest.fn(async () => options.course ?? COURSE) } as any;
  const teachers = {
    findContract: jest.fn(async (_c: string, username: string) => (options.contracts ?? []).find((x) => x.teacher_username === username) ?? null),
    saveContract: jest.fn(async (c: any) => c),
    listContracts: jest.fn(async () => options.contracts ?? []),
    listAssignments: jest.fn(async () => options.assignments ?? []),
  } as any;
  const names = { displayNames: jest.fn(async (us: string[]) => new Map(us.map((u) => [u, `ФИО ${u}`]))) } as any;
  const extensions = { patchConfig: jest.fn(async (_n: string, patch: any) => ({ config: { markup_percent: patch.markup_percent } })) } as any;
  const ledger = {
    getWallets: jest.fn(async () => options.coopWallets ?? [{ id: 'w.edu.fund', name: 'Фонд ЦПП «Образование»', available: '50000.0000 RUB' }]),
    getHistory: jest.fn(async () => ({ items: options.history ?? [], totalCount: 0, totalPages: 0, currentPage: 1 })),
    getAccounts: jest.fn(async () => []),
  } as any;
  const userWallets = { findByWallet: jest.fn(async () => options.memberShares ?? []) } as any;
  return {
    service: new EdubridgeEconomyService(config, courses, teachers, names, extensions, ledger, userWallets),
    teachers,
    extensions,
    config,
    ledger,
  };
}

const params = {
  lessons_per_month: 8,
  lessons_total: 64,
  lesson_minutes: 60,
  planned_hourly_rate: '1000.0000 RUB',
  year_discount_percent: 0,
};

describe('Расчёт взноса курса', () => {
  it('себестоимость — часы по ставке, взнос — с наценкой кооператива', () => {
    const calc = calculateCourseFee({ lessons_per_month: 8, lesson_hours: 1, hourly_rate: '1000.0000 RUB', markup_percent: 20, year_discount_percent: 0 });
    expect(calc.hours_per_month).toBe(8);
    expect(calc.cost_month).toBe('8000.0000 RUB');
    expect(calc.markup_month).toBe('1600.0000 RUB');
    expect(calc.fee_month).toBe('9600.0000 RUB');
    expect(calc.fee_year_base).toBe('115200.0000 RUB');
    expect(calc.fee_year).toBe('115200.0000 RUB');
  });

  it('занятие в полтора часа: часы считаются из минут', () => {
    const calc = calculateCourseFee({ lessons_per_month: 4, lesson_hours: 90 / 60, hourly_rate: '1000.0000 RUB', markup_percent: 0, year_discount_percent: 0 });
    expect(calc.hours_per_month).toBe(6);
    expect(calc.fee_month).toBe('6000.0000 RUB');
  });

  it('годовая скидка снимается с двенадцати месяцев', () => {
    const calc = calculateCourseFee({ lessons_per_month: 8, lesson_hours: 1, hourly_rate: '1000.0000 RUB', markup_percent: 20, year_discount_percent: 10 });
    expect(calc.year_discount_amount).toBe('11520.0000 RUB');
    expect(calc.fee_year).toBe('103680.0000 RUB');
  });

  it('предельная скидка равна доле наценки во взносе и ниже себестоимости не опускает', () => {
    expect(maxYearDiscountPercent(0)).toBe(0);
    expect(maxYearDiscountPercent(20)).toBe(16.66);
    const calc = calculateCourseFee({ lessons_per_month: 8, lesson_hours: 1, hourly_rate: '1000.0000 RUB', markup_percent: 20, year_discount_percent: 16.66 });
    expect(Number(calc.fee_year.split(' ')[0])).toBeGreaterThanOrEqual(Number(calc.cost_year.split(' ')[0]));
  });

  it('нулевая ставка даёт нулевой взнос — курс без себестоимости', () => {
    const calc = calculateCourseFee({ lessons_per_month: 8, lesson_hours: 1, hourly_rate: '0.0000 RUB', markup_percent: 20, year_discount_percent: 0 });
    expect(calc.fee_month).toBe('0.0000 RUB');
  });
});

describe('EdubridgeEconomyService', () => {
  it('наценка одна на кооператив: сохраняется в настройке расширения', async () => {
    const { service, extensions } = make({ markup: 0 });
    const saved = await service.setMarkup(25);
    expect(extensions.patchConfig).toHaveBeenCalledWith('edubridge', { markup_percent: 25 });
    expect(saved.markup_percent).toBe(25);
    expect(saved.max_year_discount_percent).toBe(20);
  });

  it('скидка больше наценки — отказ с предельным значением в тексте', async () => {
    const { service } = make({ markup: 20 });
    await expect(service.feeForCourse({ ...params, year_discount_percent: 30 })).rejects.toThrow(/Предельная скидка — 16.66%/);
  });

  it('скидка ровно по пределу принимается', async () => {
    const { service } = make({ markup: 20 });
    const fee = await service.feeForCourse({ ...params, year_discount_percent: 16.66 });
    expect(fee.fee_month).toBe('9600.0000 RUB');
    expect(fee.fee_year).toBe('96007.6800 RUB');
  });

  it('ставку часа правит администратор — она пишется в договор преподавателя', async () => {
    const contracts = [{ teacher_username: 'teach', hourly_rate: '0.0000 RUB', status: EduContractStatus.ACTIVE }];
    const { service, teachers } = make({ contracts });
    await service.setTeacherRate('voskhod', 'teach', '1500.0000 RUB');
    expect(teachers.saveContract).toHaveBeenCalledWith(expect.objectContaining({ hourly_rate: '1500.0000 RUB' }));
  });

  it('ставка пайщику без договора участия — отказ', async () => {
    const { service } = make({ contracts: [] });
    await expect(service.setTeacherRate('voskhod', 'stranger', '1500.0000 RUB')).rejects.toThrow(/договора участия/);
  });

  it('план и факт: назначенные преподаватели дороже плановой ставки — предупреждение', async () => {
    const contracts = [
      { teacher_username: 'teach', hourly_rate: '1500.0000 RUB', status: EduContractStatus.ACTIVE },
      { teacher_username: 'other', hourly_rate: '1000.0000 RUB', status: EduContractStatus.ACTIVE },
    ];
    const assignments = [
      { teacher_username: 'teach', course_id: COURSE_ID, minutes_per_month: 480, status: EduAssignmentStatus.ACTIVE },
      { teacher_username: 'other', course_id: COURSE_ID, minutes_per_month: 240, status: EduAssignmentStatus.DRAFT },
    ];
    const { service } = make({ markup: 20, contracts, assignments });
    const economy = await service.courseEconomy('voskhod', COURSE_ID);
    expect(economy.plan.fee_month).toBe('9600.0000 RUB');
    // Неподписанное назначение в факт не идёт: обязательства возникают с действующего приложения.
    expect(economy.teachers).toHaveLength(1);
    expect(economy.actual_hours_per_month).toBe(8);
    expect(economy.actual_cost_month).toBe('12000.0000 RUB');
    expect(economy.over_fee).toBe(true);
  });

  it('план и факт сходятся, когда ставка преподавателя равна плановой', async () => {
    const contracts = [{ teacher_username: 'teach', hourly_rate: '1000.0000 RUB', status: EduContractStatus.ACTIVE }];
    const assignments = [{ teacher_username: 'teach', course_id: COURSE_ID, minutes_per_month: 480, status: EduAssignmentStatus.ACTIVE }];
    const { service } = make({ markup: 20, contracts, assignments });
    const economy = await service.courseEconomy('voskhod', COURSE_ID);
    expect(economy.actual_cost_month).toBe('8000.0000 RUB');
    expect(economy.over_fee).toBe(false);
  });
});

describe('Деньги программы', () => {
  it('фонд и остатки учеников читаются из разных мест и складываются в картину', async () => {
    const { service } = make({
      memberShares: [{ available: '1200.0000 RUB' }, { available: '300.0000 RUB' }],
      history: [
        {
          globalSequence: '101',
          createdAt: new Date('2026-09-19T10:00:00Z'),
          operationCode: 'o.edu.fee',
          quantity: '9600.0000 RUB',
          username: 'parent',
          memo: '',
        },
      ],
    });
    const fund = await service.fund('voskhod');
    expect(fund.fund_balance).toBe('50000.0000 RUB');
    expect(fund.members_balance).toBe('1500.0000 RUB');
    expect(fund.wallets.map((w) => w.id)).toEqual(['w.edu.fund', 'w.edu.member']);
    expect(fund.movements).toHaveLength(1);
    expect(fund.movements[0]!.title).toBe('Взнос за курс списан в фонд программы');
    expect(fund.movements[0]!.username).toBe('parent');
  });

  it('пустой фонд показывается нулём, а не пропадает из списка', async () => {
    const { service } = make({ coopWallets: [] });
    const fund = await service.fund('voskhod');
    expect(fund.fund_balance).toBe('0.0000 RUB');
    expect(fund.wallets).toHaveLength(2);
  });
});
