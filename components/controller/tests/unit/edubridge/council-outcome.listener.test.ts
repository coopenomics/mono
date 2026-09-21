/** Совет не принял решение по заявлению РИД: отклонение и снятие просроченного вопроса помечают заявление. */
import { EdubridgeApprovalListener } from '~/extensions/edubridge/application/listeners/edubridge-approval.listener';
import { EduCouncilOutcome } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

function make() {
  const teachers = { onCouncilGaveUp: jest.fn(async () => undefined) } as any;
  return { listener: new EdubridgeApprovalListener(teachers, logger), teachers };
}

describe('EdubridgeApprovalListener — исход совета по заявлению РИД', () => {
  it('отклонение вопроса советом помечает заявление как отклонённое', async () => {
    const { listener, teachers } = make();
    await listener.onCouncilDeclined({ data: { coopname: 'voskhod', decision_id: 77 } } as any);
    expect(teachers.onCouncilGaveUp).toHaveBeenCalledWith('voskhod', '77', EduCouncilOutcome.DECLINED);
  });

  it('снятие просроченного вопроса помечает заявление как просроченное', async () => {
    const { listener, teachers } = make();
    await listener.onCouncilExpired({ data: { coopname: 'voskhod', decision_id: '0' } } as any);
    // Нулевой номер вопроса — настоящий номер, а не «пусто».
    expect(teachers.onCouncilGaveUp).toHaveBeenCalledWith('voskhod', '0', EduCouncilOutcome.EXPIRED);
  });

  it('действие без кооператива либо без номера вопроса пропускается', async () => {
    const { listener, teachers } = make();
    await listener.onCouncilDeclined({ data: { decision_id: 1 } } as any);
    await listener.onCouncilExpired({ data: { coopname: 'voskhod' } } as any);
    expect(teachers.onCouncilGaveUp).not.toHaveBeenCalled();
  });
});
