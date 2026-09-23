/** Одобрения образовательной программы в карточке преподавателя — через порт одобрений председателя. */
import { EdubridgeApprovalsService } from '~/extensions/edubridge/application/services/edubridge-approvals.service';

describe('EdubridgeApprovalsService — документы преподавателя на подписи председателя', () => {
  it('спрашивает у председателя только договор и приложения этого преподавателя, ждущие подписи', async () => {
    const port = {
      list: jest.fn(async () => [
        { approval_hash: 'h1', coopname: 'voskhod', username: 'ant', action: 'apprvcontr', status: 'pending', created_at: '2026-09-23T08:08:30.000Z' },
        { approval_hash: 'h2', coopname: 'voskhod', username: 'ant', action: 'apprvannex', status: 'pending', created_at: '2026-09-23T09:00:00.000Z' },
      ]),
    };
    const service = new EdubridgeApprovalsService(port as any);
    const found = await service.pendingForTeacher('voskhod', 'ant');

    expect(port.list).toHaveBeenCalledWith({ coopname: 'voskhod', actions: ['apprvcontr', 'apprvannex'], usernames: ['ant'], statuses: ['pending'] });
    expect(found.map((a) => a.title)).toEqual(['Договор участия в хозяйственной деятельности', 'Приложение к договору на курс']);
    expect(found[0]!.created_at).toEqual(new Date('2026-09-23T08:08:30.000Z'));
  });

  it('без расширения председателя — пустой список, а не отказ', async () => {
    await expect(new EdubridgeApprovalsService(null).pendingForTeacher('voskhod', 'ant')).resolves.toEqual([]);
  });
});
