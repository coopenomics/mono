/** Числа на пунктах меню стола администратора Образования. */
import { EdubridgeAttentionService } from '~/extensions/edubridge/application/services/edubridge-attention.service';
import { EduAccessTaskStatus } from '~/extensions/edubridge/domain/enums';

function make() {
  const approvals = { pendingCount: jest.fn(async () => 2) } as any;
  const tasks = { countByStatuses: jest.fn(async () => 3) } as any;
  return { service: new EdubridgeAttentionService(approvals, tasks), approvals, tasks };
}

describe('EdubridgeAttentionService — дела, ждущие администратора', () => {
  it('администратор видит документы на подписи председателя и застрявшие задачи выдачи доступа', async () => {
    const { service, tasks } = make();
    await expect(service.summary('voskhod', ['admin'])).resolves.toEqual({ teachers: 2, learners: 3 });
    expect(tasks.countByStatuses).toHaveBeenCalledWith('voskhod', [EduAccessTaskStatus.NEEDS_ATTENTION, EduAccessTaskStatus.FAILED]);
  });

  it('ученик или преподаватель без прав администратора — нули, чужое не считается', async () => {
    const { service, approvals, tasks } = make();
    await expect(service.summary('voskhod', ['learner', 'teacher'])).resolves.toEqual({ teachers: 0, learners: 0 });
    expect(approvals.pendingCount).not.toHaveBeenCalled();
    expect(tasks.countByStatuses).not.toHaveBeenCalled();
  });
});
