/** Граница оплаченного периода: закрытие подписки в цепи, отзыв доступа и подписка, которой в цепи уже нет. */
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
  const chain = { expireSubscription: jest.fn(async () => ({ transaction_id: 'TRX' })), allotReserve: jest.fn(async () => ({})) } as any;
  const enrollmentService = { unlockDue: jest.fn(async () => 0) } as any;
  const worker = new EdubridgeExpiryWorker(enrollments, {} as any, courses, outbox, {} as any, enrollmentService, chain, {} as any, logger);
  return { worker, enrollments, outbox, chain, enrollmentService };
}

const sub = (id: string) => ({ id, sub_hash: `h${id}`, course_id: 'C1', status: EduEnrollmentStatus.ACTIVE, paid_until: new Date('2026-01-01') });

describe('EdubridgeExpiryWorker', () => {
  it('истёкшая подписка: expiresub в цепь, статус «истекла», доступ отзывается', async () => {
    const e = sub('1');
    const { worker, outbox, chain } = make([e]);
    await worker.expire('voskhod');
    expect(chain.expireSubscription).toHaveBeenCalledWith({ coopname: 'voskhod', sub_hash: 'h1' });
    expect(e.status).toBe(EduEnrollmentStatus.EXPIRED);
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: EduAccessTaskKind.REVOKE, trigger: 'TRX' }));
  });

  it('подписки в цепи уже нет: запись всё равно закрывается и доступ отзывается — очередь о неё не спотыкается', async () => {
    const e = sub('2');
    const { worker, outbox, chain } = make([e]);
    chain.expireSubscription.mockRejectedValue(new Error('assertion failure with message: Подписка с указанным hash не найдена'));
    await worker.expire('voskhod');
    expect(e.status).toBe(EduEnrollmentStatus.EXPIRED);
    expect(outbox.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: EduAccessTaskKind.REVOKE }));
  });

  it('цепь не отвечает: подписка остаётся действующей до следующего прохода, остальные обрабатываются', async () => {
    const first = sub('3');
    const second = sub('4');
    const { worker, outbox, chain } = make([first, second]);
    chain.expireSubscription.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    await worker.expire('voskhod');
    expect(first.status).toBe(EduEnrollmentStatus.ACTIVE);
    expect(second.status).toBe(EduEnrollmentStatus.EXPIRED);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('подписка закрыта раньше конца гарантийного срока курса: удержанное цепь вернула сама, резерв преподавателям выделяется отдельно', async () => {
    const e = { ...sub('6'), locked_amount: '1000.0000 RUB', locked_reserve: '800.0000 RUB' } as any;
    const { worker, chain } = make([e]);
    await worker.expire('voskhod');
    expect(chain.allotReserve).toHaveBeenCalledWith({ coopname: 'voskhod', sub_hash: 'h6', amount: '800.0000 RUB' });
    expect(e.locked_amount).toBeNull();
    expect(e.locked_reserve).toBeNull();
    expect(e.status).toBe(EduEnrollmentStatus.EXPIRED);
  });

  it('сбой выделения резерва закрытие подписки не отменяет', async () => {
    const e = { ...sub('7'), locked_amount: '1000.0000 RUB', locked_reserve: '800.0000 RUB' } as any;
    const { worker, chain, outbox } = make([e]);
    chain.allotReserve.mockRejectedValue(new Error('в фонде недостаточно средств'));
    await worker.expire('voskhod');
    expect(e.status).toBe(EduEnrollmentStatus.EXPIRED);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('досрочный отзыв при выходе пайщика переживает отсутствие записи в цепи', async () => {
    const e = sub('5');
    const { worker, chain, outbox } = make([e]);
    chain.expireSubscription.mockRejectedValue(new Error('Подписка с указанным hash не найдена'));
    await worker.revokeAllForMember('voskhod', 'ant', 'exit');
    expect(e.status).toBe(EduEnrollmentStatus.REVOKED);
    expect(outbox.enqueue).toHaveBeenCalled();
  });
});
