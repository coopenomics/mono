/** Граница оплаченного периода: отзыв доступа, срок на отчёт преподавателя, закрытие подписки в цепи и подписка, которой в цепи уже нет. */
import { EdubridgeExpiryWorker } from '~/extensions/edubridge/application/workers/edubridge-expiry.worker';
import { EduAccessTaskKind, EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

function make(due: any[]) {
  const enrollments = {
    findExpired: jest.fn(async () => due),
    findChainCloseDue: jest.fn(async () => [] as any[]),
    findActiveByMember: jest.fn(async () => due),
    save: jest.fn(async (e: any) => e),
  } as any;
  const courses = { findById: jest.fn(async () => ({ id: 'C1', carrier: 'skillspace' })) } as any;
  const outbox = { enqueue: jest.fn(async () => undefined) } as any;
  const chain = { expireSubscription: jest.fn(async () => ({ transaction_id: 'TRX' })) } as any;
  const funds = { unlockDue: jest.fn(async () => 0), afterClosed: jest.fn(async () => undefined) } as any;
  const worker = new EdubridgeExpiryWorker(enrollments, {} as any, courses, outbox, {} as any, funds, { retryPendingClosures: jest.fn(async () => 0) } as any, { publishPending: jest.fn(async () => 0) } as any, chain, {} as any, logger);
  return { worker, enrollments, outbox, chain, funds };
}

const sub = (id: string) => ({ id, sub_hash: `h${id}`, course_id: 'C1', status: EduEnrollmentStatus.ACTIVE, paid_until: new Date('2026-01-01') });

describe('EdubridgeExpiryWorker', () => {
  it('оплаченный срок вышел: доступ отзывается сразу, подписка в цепи остаётся на срок отчёта преподавателя', async () => {
    const e = sub('1') as any;
    const { worker, outbox, chain, funds } = make([e]);
    await worker.expire('voskhod');
    expect(e.status).toBe(EduEnrollmentStatus.EXPIRED);
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: EduAccessTaskKind.REVOKE }));
    // Занятия оплаченного срока ещё могут быть отчитаны: в цепи подписка не закрыта, срок закрытия — через семь суток.
    expect(chain.expireSubscription).not.toHaveBeenCalled();
    expect(funds.afterClosed).not.toHaveBeenCalled();
    expect(e.chain_close_after).toEqual(new Date('2026-01-08'));
  });

  it('срок на отчёт вышел: подписка закрывается в цепи, учёт курса выравнивается, срок закрытия снимается', async () => {
    const e = { ...sub('2'), status: EduEnrollmentStatus.EXPIRED, chain_close_after: new Date('2026-01-08'), locked_amount: '400.0000 RUB' } as any;
    const { worker, chain, funds, enrollments } = make([]);
    enrollments.findChainCloseDue.mockResolvedValue([e]);
    await expect(worker.closeReported('voskhod')).resolves.toBe(1);
    expect(chain.expireSubscription).toHaveBeenCalledWith({ coopname: 'voskhod', sub_hash: 'h2' });
    expect(funds.afterClosed).toHaveBeenCalledWith('voskhod', e);
    expect(e.chain_close_after).toBeNull();
  });

  it('подписки в цепи уже нет: срок закрытия всё равно снимается — очередь о неё не спотыкается', async () => {
    const e = { ...sub('3'), status: EduEnrollmentStatus.EXPIRED, chain_close_after: new Date('2026-01-08') } as any;
    const { worker, chain, enrollments } = make([]);
    enrollments.findChainCloseDue.mockResolvedValue([e]);
    chain.expireSubscription.mockRejectedValue(new Error('assertion failure with message: EDUBRIDGE_SUBSCRIPTION_NOT_FOUND: Подписка с указанным hash не найдена'));
    await expect(worker.closeReported('voskhod')).resolves.toBe(1);
    expect(e.chain_close_after).toBeNull();
  });

  it('по подписке идёт расчёт открытого занятия либо цепь не отвечает: закрытие повторится, остальные обрабатываются', async () => {
    const first = { ...sub('4'), status: EduEnrollmentStatus.EXPIRED, chain_close_after: new Date('2026-01-08') } as any;
    const second = { ...sub('5'), status: EduEnrollmentStatus.EXPIRED, chain_close_after: new Date('2026-01-08') } as any;
    const { worker, chain, enrollments } = make([]);
    enrollments.findChainCloseDue.mockResolvedValue([first, second]);
    chain.expireSubscription.mockRejectedValueOnce(new Error('assertion failure with message: EDUBRIDGE_SUBSCRIPTION_LESSON_PENDING: По подписке не завершён расчёт за проведённое занятие'));
    await expect(worker.closeReported('voskhod')).resolves.toBe(1);
    expect(first.chain_close_after).toEqual(new Date('2026-01-08'));
    expect(second.chain_close_after).toBeNull();
  });

  it('досрочный отзыв при выходе пайщика переживает отсутствие записи в цепи', async () => {
    const e = sub('5');
    const { worker, chain, outbox } = make([e]);
    chain.expireSubscription.mockRejectedValue(new Error("assertion failure with message: EDUBRIDGE_SUBSCRIPTION_NOT_FOUND: Подписка с указанным hash не найдена"));
    await worker.revokeAllForMember('voskhod', 'ant', 'exit');
    expect(e.status).toBe(EduEnrollmentStatus.REVOKED);
    expect(outbox.enqueue).toHaveBeenCalled();
  });
});
