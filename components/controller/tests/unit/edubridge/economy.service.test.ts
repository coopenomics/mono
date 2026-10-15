/** Экономика курса: себестоимость из часов по ставке, наценка кооператива, взнос за весь курс разом со скидкой, план и факт. */
import { EdubridgeEconomyService } from '~/extensions/edubridge/application/services/edubridge-economy.service';
import { calculateCourseFee, feeForMonths, feeForPeriod, maxCourseDiscountPercent } from '~/extensions/edubridge/domain/economy/course-fee.calculator';
import { EduAssignmentStatus, EduContractStatus } from '~/extensions/edubridge/domain/enums';

const COURSE_ID = '0cd16d12-6ade-40f2-8830-b0673dde8b9e';

/** Курс: два часовых окна в неделю (480 минут в месяц), программа восемь месяцев, плановая ставка 1000 ₽/ч, взнос только помесячный. */
const COURSE = {
  id: COURSE_ID,
  schedule_slots: [{ weekday: 2, time: '17:00', minutes: 60, assignment_id: null, hourly_rate: '1000.0000 RUB' }, { weekday: 4, time: '17:00', minutes: 60, assignment_id: null, hourly_rate: '1000.0000 RUB' }],
  program_months: 8,
  lessons_per_month: 8,
  lessons_total: 64,
  lesson_minutes: 60,
  minutes_per_month: 480,
  minutes_total: 3840,
  course_payment_enabled: false,
  course_discount_bp: 0,
  fee_month: '9600.0000 RUB',
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
    returns?: any[];
    contributions?: any[];
    payments?: Record<string, any>;
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
    listShareReturns: jest.fn(async () => options.returns ?? []),
    findContributionByActHash: jest.fn(async (_c: string, h: string) => (options.contributions ?? []).find((x: any) => x.act_hash === h) ?? null),
  } as any;
  const names = { displayNames: jest.fn(async (us: string[]) => new Map(us.map((u) => [u, `ФИО ${u}`]))) } as any;
  const extensions = { patchConfig: jest.fn(async (_n: string, patch: any) => ({ config: { markup_percent: patch.markup_percent } })) } as any;
  const ledger = {
    getWallets: jest.fn(async () => options.coopWallets ?? [{ id: 'w.edu.fund', name: 'Фонд ЦПП «Образование»', available: '50000.0000 RUB' }]),
    getHistory: jest.fn(async () => ({ items: options.history ?? [], totalCount: 0, totalPages: 0, currentPage: 1 })),
    getAccounts: jest.fn(async () => []),
  } as any;
  const userWallets = { findByWallet: jest.fn(async () => options.memberShares ?? []) } as any;
  const payments = { findByHash: jest.fn(async (h: string) => options.payments?.[h] ?? null) } as any;
  return {
    service: new EdubridgeEconomyService(config, courses, teachers, names, extensions, ledger, userWallets, payments, { findByCourse: jest.fn(async () => []), findByGroup: jest.fn(async () => []) } as any, { findByCourse: jest.fn(async () => []), findByGroup: jest.fn(async () => []) } as any, { list: jest.fn(async () => []), viewOf: (c: any) => c } as any),
    teachers,
    extensions,
    config,
    ledger,
  };
}

const params = {
  schedule_slots: [{ weekday: 2, time: '17:00', minutes: 60, assignment_id: null, hourly_rate: '1000.0000 RUB' }, { weekday: 4, time: '17:00', minutes: 60, assignment_id: null, hourly_rate: '1000.0000 RUB' }],
  program_months: 8,
  course_payment_enabled: true,
  course_discount_percent: 0,
};

const base = { minutes_per_month: 480, program_months: 8, teach_month: '8000.0000 RUB', markup_percent: 20, course_discount_percent: 0 };

describe('Программа с неполным месяцем', () => {
  it('3,5 месяца — три месяца и две недели: взнос за курс и себестоимость — за 14 недель', () => {
    const calc = calculateCourseFee({ ...base, program_months: 3.5, course_discount_percent: 10 });
    expect(calc.course_months).toBe(3.5);
    expect(calc.fee_course_base).toBe('33600.0000 RUB');
    expect(calc.course_discount_amount).toBe('3360.0000 RUB');
    expect(calc.fee_course).toBe('30240.0000 RUB');
    expect(calc.cost_course).toBe('28000.0000 RUB');
  });

  it('взнос за срок считается по оплаченным минутам: остаток программы меньше полных месяцев — доля месячного взноса', () => {
    // Четыре срока по месяцу, а минут в программе на три с половиной: 1680 из 1920.
    expect(feeForPeriod('9600.0000 RUB', 4, 1680, 480, 10)).toEqual({ base: '33600.0000 RUB', discount: '3360.0000 RUB', amount: '30240.0000 RUB' });
    // Последний неполный месяц: две недели — половина месячного взноса.
    expect(feeForPeriod('9600.0000 RUB', 1, 240, 480)).toEqual({ base: '4800.0000 RUB', discount: '0.0000 RUB', amount: '4800.0000 RUB' });
    // Минут хватает на полные месяцы — месячный взнос на число месяцев.
    expect(feeForPeriod('9600.0000 RUB', 3, 1440, 480)).toEqual({ base: '28800.0000 RUB', discount: '0.0000 RUB', amount: '28800.0000 RUB' });
    expect(feeForMonths('9600.0000 RUB', 3.5, 0).base).toBe('33600.0000 RUB');
  });
});

describe('Расчёт взноса курса', () => {
  it('себестоимость — часы по ставке, взнос — с наценкой кооператива', () => {
    const calc = calculateCourseFee(base);
    expect(calc.hours_per_month).toBe(8);
    expect(calc.cost_month).toBe('8000.0000 RUB');
    expect(calc.markup_month).toBe('1600.0000 RUB');
    expect(calc.fee_month).toBe('9600.0000 RUB');
  });

  it('себестоимость — стоимости окон месяца, часы только для показа', () => {
    const calc = calculateCourseFee({ ...base, minutes_per_month: 480, teach_month: '8000.0000 RUB', markup_percent: 0 });
    expect(calc.hours_per_month).toBe(8);
    expect(calc.fee_month).toBe('8000.0000 RUB');
  });

  it('длительность курса — месяцы программы, как их назвал администратор', () => {
    expect(calculateCourseFee({ ...base, program_months: 9 }).course_months).toBe(9);
    expect(calculateCourseFee({ ...base, program_months: 0 }).course_months).toBe(0);
  });

  it('взнос за весь курс — месячный за месяцы курса, а не за двенадцать', () => {
    const calc = calculateCourseFee(base);
    expect(calc.course_months).toBe(8);
    expect(calc.fee_course_base).toBe('76800.0000 RUB');
    expect(calc.fee_course).toBe('76800.0000 RUB');
    expect(calc.cost_course).toBe('64000.0000 RUB');
  });

  it('скидка за взнос разом снимается с суммы помесячных', () => {
    const calc = calculateCourseFee({ ...base, course_discount_percent: 10 });
    expect(calc.course_discount_amount).toBe('7680.0000 RUB');
    expect(calc.fee_course).toBe('69120.0000 RUB');
  });

  it('пришедший в середине вносит за оставшиеся месяцы с той же скидкой', () => {
    const rest = feeForMonths('9600.0000 RUB', 3, 10);
    expect(rest.base).toBe('28800.0000 RUB');
    expect(rest.discount).toBe('2880.0000 RUB');
    expect(rest.amount).toBe('25920.0000 RUB');
  });

  it('предельная скидка — целая часть доли наценки во взносе, ниже себестоимости не опускает', () => {
    expect(maxCourseDiscountPercent(0)).toBe(0);
    expect(maxCourseDiscountPercent(20)).toBe(16);
    expect(maxCourseDiscountPercent(30)).toBe(23);
    expect(maxCourseDiscountPercent(50)).toBe(33);
    const calc = calculateCourseFee({ ...base, course_discount_percent: 16 });
    expect(Number(calc.fee_course.split(' ')[0])).toBeGreaterThanOrEqual(Number(calc.cost_course.split(' ')[0]));
  });

  it('курс без конечной программы: взноса за курс нет', () => {
    const calc = calculateCourseFee({ ...base, program_months: 0 });
    expect(calc.course_months).toBe(0);
    expect(calc.fee_course).toBe('0.0000 RUB');
  });

  it('нулевая ставка даёт нулевой взнос — курс без себестоимости', () => {
    const calc = calculateCourseFee({ ...base, teach_month: '0.0000 RUB' });
    expect(calc.fee_month).toBe('0.0000 RUB');
  });
});

describe('EdubridgeEconomyService', () => {
  it('наценка одна на кооператив: сохраняется в настройке расширения', async () => {
    const { service, extensions } = make({ markup: 0 });
    const saved = await service.setMarkup(25);
    expect(extensions.patchConfig).toHaveBeenCalledWith('edubridge', { markup_percent: 25 });
    expect(saved.markup_percent).toBe(25);
    expect(saved.max_course_discount_percent).toBe(20);
  });

  it('скидка больше наценки — отказ с предельным значением в тексте', async () => {
    const { service } = make({ markup: 20 });
    await expect(service.feeForCourse({ ...params, course_discount_percent: 30 })).rejects.toThrow(/Предельная скидка — 16%/);
  });

  it('скидка ровно по пределу принимается', async () => {
    const { service } = make({ markup: 20 });
    const fee = await service.feeForCourse({ ...params, course_discount_percent: 16 });
    expect(fee.fee_month).toBe('9600.0000 RUB');
  });

  it('взнос только помесячный: скидка не проверяется и не действует', async () => {
    const { service } = make({ markup: 20 });
    const fee = await service.feeForCourse({ ...params, course_payment_enabled: false, course_discount_percent: 90 });
    expect(fee.fee_month).toBe('9600.0000 RUB');
    const preview = await service.preview({ ...params, course_payment_enabled: false, course_discount_percent: 90 });
    expect(preview.fee_course).toBe(preview.fee_course_base);
  });

  it('взнос за курс без программы — отказ: считать его не от чего', async () => {
    const { service } = make({ markup: 20 });
    await expect(service.feeForCourse({ ...params, program_months: 0 })).rejects.toThrow(/укажите, сколько в ней занятий/);
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
      { teacher_username: 'other', course_id: COURSE_ID, minutes_per_month: 240, status: EduAssignmentStatus.CLOSED },
    ];
    const { service } = make({ markup: 20, contracts, assignments });
    const economy = await service.courseEconomy('voskhod', COURSE_ID);
    expect(economy.plan.fee_month).toBe('9600.0000 RUB');
    // Снятый допуск в факт не идёт: обязательства возникают по действующим назначениям.
    expect(economy.teachers).toHaveLength(1);
    expect(economy.actual_hours_per_month).toBe(8);
    expect(economy.actual_cost_month).toBe('12000.0000 RUB');
    expect(economy.over_fee).toBe(true);
  });

  it('несколько преподавателей на курсе: прогноз — занятия курса один раз, по наибольшей ставке; нагрузка не распределяется', async () => {
    const contracts = [
      { teacher_username: 'teach', hourly_rate: '900.0000 RUB', status: EduContractStatus.ACTIVE },
      { teacher_username: 'other', hourly_rate: '700.0000 RUB', status: EduContractStatus.ACTIVE },
    ];
    // Нагрузка в допусках в расчёт не идёт: занятие оплачивается один раз, кто бы его ни провёл.
    const assignments = [
      { teacher_username: 'teach', course_id: COURSE_ID, minutes_per_month: 480, status: EduAssignmentStatus.ACTIVE },
      { teacher_username: 'other', course_id: COURSE_ID, minutes_per_month: 480, status: EduAssignmentStatus.ACTIVE },
    ];
    const { service } = make({ markup: 20, contracts, assignments });
    const economy = await service.courseEconomy('voskhod', COURSE_ID);
    expect(economy.teachers.map((t) => t.cost_month)).toEqual(['7200.0000 RUB', '5600.0000 RUB']);
    expect(economy.actual_cost_month).toBe('7200.0000 RUB');
    expect(economy.actual_hours_per_month).toBe(8);
    expect(economy.over_fee).toBe(false);
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
    // Свободные средства и резерв выплат преподавателям показаны раздельно.
    expect(fund.wallets.map((w) => w.id)).toEqual(['w.edu.fund', 'w.edu.escrow', 'w.edu.teach', 'w.edu.member']);
    expect(fund.wallets[1]!.available).toBe('0.0000 RUB');
    expect(fund.movements).toHaveLength(1);
    expect(fund.movements[0]!.title).toBe('Взнос за курс списан на кошелёк программы');
    // На экране кошелёк называется кошельком программы, каким бы ни было имя в реестре книги учёта.
    expect(fund.wallets[0]!.name).toBe('Кошелёк ЦПП «Образование»');
    expect(fund.movements[0]!.username).toBe('parent');
    expect(fund.movements[0]!.display_name).toBe('ФИО parent');
    // У каждого кошелька короткая подпись для карточки и подробная подсказка под знаком вопроса.
    expect(fund.wallets.every((w) => w.summary.length > 0 && w.summary.length <= 45 && w.hint.length > w.summary.length)).toBe(true);
  });

  it('пустой фонд показывается нулём, а не пропадает из списка', async () => {
    const { service } = make({ coopWallets: [] });
    const fund = await service.fund('voskhod');
    expect(fund.fund_balance).toBe('0.0000 RUB');
    expect(fund.wallets).toHaveLength(4);
  });

  it('резерв выплат преподавателям читается из своего кошелька', async () => {
    const { service } = make({
      coopWallets: [
        { id: 'w.edu.fund', name: 'Фонд ЦПП «Образование»', available: '200.0000 RUB' },
        { id: 'w.edu.teach', name: 'Резерв выплат преподавателям ЦПП «Образование»', available: '800.0000 RUB' },
        { id: 'w.edu.escrow', name: 'Взносы ЦПП «Образование», удержанные до конца гарантийного срока', available: '3000.0000 RUB' },
      ],
    });
    const fund = await service.fund('voskhod');
    expect(fund.fund_balance).toBe('200.0000 RUB');
    expect(fund.wallets.find((w) => w.id === 'w.edu.teach')!.available).toBe('800.0000 RUB');
    // Удержанное до конца гарантийного срока в свободные средства не входит.
    expect(fund.wallets.find((w) => w.id === 'w.edu.escrow')!.available).toBe('3000.0000 RUB');
  });
});

describe('Выписка преподавателя', () => {
  const HASH = 'a'.repeat(64);
  const accepted = { globalSequence: '201', createdAt: new Date('2026-10-07T11:33:00Z'), operationCode: 'o.edu.ridshr', quantity: '1000.0000 RUB', username: 'ant', processHash: 'act1', memo: '' };
  const ret = { id: 'R1', amount: '1000.0000 RUB', payment_hash: HASH, created_at: new Date('2026-10-07T12:00:00Z') };

  it('зачисления по актам и возвраты по платежам идут одной лентой, свежее сверху', async () => {
    const { service, ledger } = make({
      history: [accepted],
      contributions: [{ id: 'K1', act_hash: 'act1' }],
      returns: [ret],
      payments: { [HASH]: { status: 'awaiting_authorization' } },
    });
    const items = await service.settlementJournal('voskhod', 'ant');
    // Книга учёта читается только по кошельку преподавателя и только по зачислениям: чужое и фонд в выписку не попадают.
    expect(ledger.getHistory).toHaveBeenCalledWith(expect.objectContaining({ coopname: 'voskhod', username: 'ant', walletName: 'w.edu.share', operationCodes: ['o.edu.ridshr'] }));
    expect(items.map((e) => [e.kind, e.status, e.contribution_id, e.return_id])).toEqual([
      ['out', 'council_review', null, 'R1'],
      ['in', 'accepted', 'K1', null],
    ]);
    expect(items[1]!.title).toBe('Результат принят, взнос зачислен');
    expect(items[0]!.payment_hash).toBe(HASH);
  });

  it.each([
    ['pending', 'awaiting_payout'],
    ['processing', 'awaiting_payout'],
    ['paid', 'paid'],
    ['completed', 'paid'],
    ['cancelled', 'declined'],
    ['failed', 'declined'],
    ['expired', 'declined'],
  ])('платёж «%s» показывает возврат как «%s»', async (payment, status) => {
    const { service } = make({ returns: [ret], payments: { [HASH]: { status: payment } } });
    const [row] = await service.settlementJournal('voskhod', 'ant');
    expect(row!.status).toBe(status);
  });

  it('платёж возврата не найден — возврат показан как несостоявшийся, а не как ожидающий', async () => {
    const { service } = make({ returns: [ret] });
    const [row] = await service.settlementJournal('voskhod', 'ant');
    expect(row!.status).toBe('declined');
  });

  it('зачисление без взноса в базе остаётся в выписке без ссылки на взнос', async () => {
    const { service } = make({ history: [accepted] });
    const [row] = await service.settlementJournal('voskhod', 'ant');
    expect(row!.contribution_id).toBeNull();
    expect(row!.amount).toBe('1000.0000 RUB');
  });

  it('без движений выписка пуста, а не падает', async () => {
    const { service } = make();
    expect(await service.settlementJournal('voskhod', 'ant')).toEqual([]);
  });
});
