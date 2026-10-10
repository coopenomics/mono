/** Числа на пунктах меню стола администратора Образования. */
import { EdubridgeAttentionService } from '~/extensions/edubridge/application/services/edubridge-attention.service';
import { EduAccessTaskStatus } from '~/extensions/edubridge/domain/enums';

function make() {
  const approvals = { pendingCount: jest.fn(async () => 2) } as any;
  const tasks = { countByStatuses: jest.fn(async () => 3) } as any;
  // Подписки, не закрывшиеся при выходе пайщика, — тоже дело администратора.
  const enrollments = { countClosePending: jest.fn(async () => 1) } as any;
  // Договоры преподавателей: одному ставка назначена, одному нет, один договор прекращён.
  const teachers = {
    listContracts: jest.fn(async () => [
      { teacher_username: 'rated', status: 'active', hourly_rate: '900.0000 RUB' },
      { teacher_username: 'unrated', status: 'pending_approval', hourly_rate: '0.0000 RUB' },
      { teacher_username: 'gone', status: 'terminated', hourly_rate: '0.0000 RUB' },
    ]),
  } as any;
  return { service: new EdubridgeAttentionService(approvals, tasks, enrollments, teachers), approvals, tasks, enrollments, teachers };
}

describe('EdubridgeAttentionService — дела, ждущие администратора', () => {
  it('администратор видит документы на подписи председателя, преподавателей без ставки и застрявшие задачи выдачи доступа', async () => {
    const { service, tasks } = make();
    await expect(service.summary('voskhod', ['edu-admin'])).resolves.toEqual({ teachers: 3, learners: 4 });
    expect(tasks.countByStatuses).toHaveBeenCalledWith('voskhod', [EduAccessTaskStatus.NEEDS_ATTENTION, EduAccessTaskStatus.FAILED]);
  });

  it('ученик или преподаватель без прав администратора — нули, чужое не считается', async () => {
    const { service, approvals, tasks } = make();
    await expect(service.summary('voskhod', ['learner', 'teacher'])).resolves.toEqual({ teachers: 0, learners: 0 });
    expect(approvals.pendingCount).not.toHaveBeenCalled();
    expect(tasks.countByStatuses).not.toHaveBeenCalled();
  });
});
