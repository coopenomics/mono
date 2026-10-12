/** Граница оплаченного периода: отзыв доступа, срок на отчёт преподавателя, закрытие подписки в цепи и подписка, которой в цепи уже нет. */
import { EdubridgeExpiryWorker } from '~/extensions/edubridge/application/workers/edubridge-expiry.worker';
import { EduAccessTaskKind, EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

function make(due: any[]) {
  const enrollments = {
    findExpired: jest.fn(async () => due),
    findActiveByMember: jest.fn(async () => due),
    save: jest.fn(async (e: any) => e),
  } as any;
  const courses = { findById: jest.fn(async () => ({ id: 'C1', carrier: 'skillspace' })) } as any;
  const outbox = { enqueue: jest.fn(async () => undefined) } as any;
  const chain = { expireSubscription: jest.fn(async () => ({ transaction_id: 'TRX' })) } as any;
  const settlement = { closeReported: jest.fn(async () => 0) } as any;
  const funds = { unlockDue: jest.fn(async () => 0), afterClosed: jest.fn(async () => undefined) } as any;
  const worker = new EdubridgeExpiryWorker(enrollments, {} as any, courses, outbox, {} as any, funds, { retryPendingClosures: jest.fn(async () => 0) } as any, { publishPending: jest.fn(async () => 0) } as any, settlement, chain, {} as any, logger);
  return { worker, enrollments, outbox, chain, funds, settlement };
}

const sub = (id: string) => ({ id, sub_hash: `h${id}`, course_id: 'C1', status: EduEnrollmentStatus.ACTIVE, paid_until: new Date('2026-01-01') });

describe('EdubridgeExpiryWorker', () => {
  it('оплаченный срок вышел: доступ отзывается сразу, подписка в цепи остаётся до закрытия расчётов', async () => {
    const e = sub('1') as any;
    const { worker, outbox, chain, funds, settlement } = make([e]);
    await worker.expire('voskhod');
    expect(e.status).toBe(EduEnrollmentStatus.EXPIRED);
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: EduAccessTaskKind.REVOKE }));
    // Занятия оплаченного срока ещё могут быть отчитаны: в цепи подписка не закрыта.
    expect(chain.expireSubscription).not.toHaveBeenCalled();
    expect(funds.afterClosed).not.toHaveBeenCalled();
    // Отметка «расчёты открыты» ставится без срока: закрытие — по отчёту о программе либо по слову администратора.
    expect(e.chain_close_after).toEqual(new Date('2026-01-01'));
    expect(settlement.closeReported).not.toHaveBeenCalled();
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
