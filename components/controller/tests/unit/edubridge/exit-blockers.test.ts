/** Почему преподавателю рано выходить из кооператива: курсы на руках и незакрытый расчёт. */
import { EdubridgeExitBlockersService } from '~/extensions/edubridge/application/services/edubridge-exit-blockers.service';
import { EduAssignmentStatus, EduContributionStatus } from '~/extensions/edubridge/domain/enums';
import { Cooperative } from 'cooptypes';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB' } }),
}));

const COURSE = { id: 'C1', title: 'Алгебра' } as any;

function make(opts: { assignments?: any[]; contributions?: any[]; subscriptions?: number; refunds?: number } = {}) {
  const teachers = {
    listAssignments: jest.fn(async () => opts.assignments ?? []),
    listContributions: jest.fn(async () => opts.contributions ?? []),
  } as any;
  const courses = { findById: jest.fn(async () => COURSE) } as any;
  const enrollments = {
    refundsOnExit: jest.fn(async () => ({ subscriptions: opts.subscriptions ?? 0, refunds: opts.refunds ?? 0 })),
  } as any;
  return { service: new EdubridgeExitBlockersService(teachers, courses, enrollments), teachers };
}

describe('Запреты выхода из кооператива у Образования', () => {
  it('родителю-слушателю выход не держат: подписки закрываются сами', async () => {
    const { service } = make();
    expect(await service.blockers('voskhod', 'ant')).toEqual([]);
  });

  it('действующий курс на руках держит выход и называет курс', async () => {
    const { service } = make({
      assignments: [{ course_id: 'C1', teacher_username: 'ant', status: EduAssignmentStatus.ACTIVE }],
    });
    const reasons = await service.blockers('voskhod', 'ant');
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('Алгебра');
  });

  it('закрытое назначение выходу не мешает', async () => {
    const { service } = make({
      assignments: [{ course_id: 'C1', teacher_username: 'ant', status: EduAssignmentStatus.CLOSED }],
    });
    expect(await service.blockers('voskhod', 'ant')).toEqual([]);
  });

  it('заявления в работе держат выход: расчёт по занятиям не закрыт', async () => {
    const { service, teachers } = make({ contributions: [{ id: 'K1' }, { id: 'K2' }] });
    const reasons = await service.blockers('voskhod', 'ant');
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('2');
    // Спрашиваем ровно те состояния, где расчёт ещё идёт.
    expect(teachers.listContributions).toHaveBeenCalledWith('voskhod', {
      teacher: 'ant',
      statuses: [
        EduContributionStatus.HELD,
        EduContributionStatus.SUBMITTED,
        EduContributionStatus.COUNCIL_APPROVED,
        EduContributionStatus.ACT_SIGNED,
      ],
    });
  });

  it('материалы на хранении без заявления: причина называет действие преподавателя, а не ожидание', async () => {
    const { service } = make({
      contributions: [
        { id: 'K1', status: EduContributionStatus.HELD, statement_document: null },
        { id: 'K2', status: EduContributionStatus.HELD, statement_document: { hash: 'S' } },
        { id: 'K3', status: EduContributionStatus.SUBMITTED },
      ],
    });
    const reasons = await service.blockers('voskhod', 'ant');
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toMatch(/без заявления о паевом взносе — 1: подпишите заявление/);
    expect(reasons[1]).toMatch(/заявлений в работе — 2/);
  });

  it(`возврат по действующим подпискам попадает в заявление ${Cooperative.Registry.ProgramAgreementsAnnulmentStatement.registry_id} строкой кошелька программы`, async () => {
    const { service } = make({ subscriptions: 2, refunds: 750 });
    expect(await service.pendingReturns('voskhod', 'ant')).toEqual([
      expect.objectContaining({ wallet_name: 'w.edu.member', amount: '750.0000 RUB' }),
    ]);
  });

  it('подписок нет либо возвращать по ним нечего — строки нет', async () => {
    expect(await make().service.pendingReturns('voskhod', 'ant')).toEqual([]);
    expect(await make({ subscriptions: 1, refunds: 0 }).service.pendingReturns('voskhod', 'ant')).toEqual([]);
  });
});
