/** Выход пайщика из кооператива: подписки закрываются с возвратом, договор УХД прекращается. */
import { EdubridgeMembershipExitListener } from '~/extensions/edubridge/application/listeners/edubridge-membership-exit.listener';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

function make() {
  const enrollments = { cancelAllForMember: jest.fn(async () => []) } as any;
  const teachers = { terminateContract: jest.fn(async () => null) } as any;
  return { listener: new EdubridgeMembershipExitListener(enrollments, teachers, logger), enrollments, teachers };
}

const exit = (data: Record<string, unknown>) => ({ transaction_id: 'TRX', data }) as any;

describe('EdubridgeMembershipExitListener', () => {
  it('заявление о выходе закрывает подписки пайщика и прекращает его договор УХД', async () => {
    const { listener, enrollments, teachers } = make();
    await listener.onExit(exit({ coopname: 'voskhod', username: 'teach' }));
    expect(enrollments.cancelAllForMember).toHaveBeenCalledWith('voskhod', 'teach', 'exitcoop TRX');
    expect(teachers.terminateContract).toHaveBeenCalledWith('voskhod', 'teach', 'выход преподавателя из кооператива');
  });

  it('сбой прекращения договора выход не роняет: подписки уже закрыты, ошибка в журнале', async () => {
    const { listener, teachers } = make();
    teachers.terminateContract.mockRejectedValue(new Error('цепь не отвечает'));
    await expect(listener.onExit(exit({ coopname: 'voskhod', username: 'teach' }))).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('договор УХД не прекращён'));
  });

  it('событие без пайщика пропускается', async () => {
    const { listener, enrollments, teachers } = make();
    await listener.onExit(exit({ coopname: 'voskhod' }));
    expect(enrollments.cancelAllForMember).not.toHaveBeenCalled();
    expect(teachers.terminateContract).not.toHaveBeenCalled();
  });
});
