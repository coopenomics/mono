/**
 * Закрытие расчётов по подпискам с вышедшим оплаченным сроком: срока на отчёт
 * нет, подписка закрывается в цепи по полному отчёту о программе группы либо
 * по слову администратора.
 */
import { EdubridgeSettlementService } from '~/extensions/edubridge/application/services/edubridge-settlement.service';
import { EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

const pendingSub = (id: string, groupId = 'G1') => ({ id, sub_hash: `h${id}`, group_id: groupId, status: EduEnrollmentStatus.EXPIRED, chain_close_after: new Date('2026-01-01') }) as any;

function make(opts: { pending: any[]; lessonsTotal?: number; lessonsOpened?: number; openLesson?: number }) {
  const enrollments = { findSettlementPending: jest.fn(async () => opts.pending), save: jest.fn(async (e: any) => e) } as any;
  const groups = { findById: jest.fn(async (_c: string, id: string) => ({ id, title: 'Группа 1', chain_ref: '1004', minutes_total: (opts.lessonsTotal ?? 8) * 60 })) } as any;
  const funds = { afterClosed: jest.fn(async () => undefined) } as any;
  const chain = {
    readTerms: jest.fn(async () => ({ minutes_opened: (opts.lessonsOpened ?? 0) * 60, charging: opts.openLesson ? 1 : 0 })),
    expireSubscription: jest.fn(async () => ({ transaction_id: 'TRX' })),
  } as any;
  return { service: new EdubridgeSettlementService(enrollments, groups, funds, chain, logger), chain, funds, enrollments };
}

describe('EdubridgeSettlementService', () => {
  it('преподаватель отчитался обо всех занятиях программы — подписки группы закрываются в цепи сами', async () => {
    const e = pendingSub('1');
    const { service, chain, funds } = make({ pending: [e], lessonsTotal: 8, lessonsOpened: 8 });
    await expect(service.closeReported('voskhod')).resolves.toBe(1);
    expect(chain.expireSubscription).toHaveBeenCalledWith({ coopname: 'voskhod', sub_hash: 'h1' });
    expect(funds.afterClosed).toHaveBeenCalledWith('voskhod', e);
    expect(e.chain_close_after).toBeNull();
  });

  it('отчитаны не все занятия, идёт расчёт последнего либо программа без конца — подписки ждут, сколько бы времени ни прошло', async () => {
    for (const opts of [{ lessonsOpened: 7 }, { lessonsOpened: 8, openLesson: 5 }, { lessonsTotal: 0, lessonsOpened: 99 }]) {
      const e = pendingSub('2');
      const { service, chain } = make({ pending: [e], ...opts });
      await expect(service.closeReported('voskhod')).resolves.toBe(0);
      expect(chain.expireSubscription).not.toHaveBeenCalled();
      expect(e.chain_close_after).toEqual(new Date('2026-01-01'));
    }
  });

  it('администратор завершает группу: закрываются расчёты её подписок, соседняя группа не затронута', async () => {
    const own = pendingSub('3');
    const other = pendingSub('4', 'G2');
    const { service, chain } = make({ pending: [own, other], lessonsOpened: 2 });
    await expect(service.closeGroup('voskhod', 'G1')).resolves.toBe(1);
    expect(chain.expireSubscription).toHaveBeenCalledTimes(1);
    expect(own.chain_close_after).toBeNull();
    expect(other.chain_close_after).toEqual(new Date('2026-01-01'));
    await expect(service.pendingCount('voskhod', 'G2')).resolves.toBe(1);
  });

  it('закрывать нечего — ноль закрытых; идёт расчёт открытого занятия — отказ со своим кодом', async () => {
    await expect(make({ pending: [] }).service.closeGroup('voskhod', 'G1')).resolves.toBe(0);
    const busy = make({ pending: [pendingSub('5')] });
    busy.chain.expireSubscription.mockRejectedValue(new Error('assertion failure with message: EDUBRIDGE_SUBSCRIPTION_LESSON_PENDING: По подписке не завершён расчёт за проведённое занятие'));
    await expect(busy.service.closeGroup('voskhod', 'G1')).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_SETTLEMENT_LESSON_PENDING' });
  });

  it('подписки в цепи уже нет — отметка всё равно снимается', async () => {
    const e = pendingSub('6');
    const { service, chain } = make({ pending: [e] });
    chain.expireSubscription.mockRejectedValue(new Error('assertion failure with message: EDUBRIDGE_SUBSCRIPTION_NOT_FOUND: Подписка с указанным hash не найдена'));
    await expect(service.closeGroup('voskhod', 'G1')).resolves.toBe(1);
    expect(e.chain_close_after).toBeNull();
  });
});
