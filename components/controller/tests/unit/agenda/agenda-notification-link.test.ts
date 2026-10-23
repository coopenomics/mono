import config from '~/config/config';
import { AgendaNotificationService } from '~/application/agenda/services/agenda-notification.service';

/**
 * Оповещение членам совета о новом вопросе ведёт на страницу этого вопроса.
 * Номер вопроса узел находит по хэшу действия: контракт пишет его в решение.
 */
function make(decisions: { id: number | string; hash: string }[] | Error) {
  const notificationPort = { notify: jest.fn(async () => undefined) } as any;
  const account = (username: string) => ({ username, provider_account: { email: `${username}@example.com`, subscriber_id: `sub-${username}` } });
  const accountPort = {
    getAccounts: jest.fn(async (filter: { role: string }) => ({ items: filter.role === 'chairman' ? [account('chair')] : [account('member')] })),
    getAccount: jest.fn(async () => ({ private_account: { organization_data: { short_name: 'ПК «Восход»' } } })),
    getDisplayName: jest.fn(async () => 'Иванов Иван Иванович'),
  } as any;
  const sovietPort = {
    getDecisions: jest.fn(async () => {
      if (decisions instanceof Error) throw decisions;
      return decisions;
    }),
  } as any;
  const logger = { setContext: jest.fn(), log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
  const service = new AgendaNotificationService(notificationPort, accountPort, sovietPort, logger);
  return { service, notificationPort, sovietPort };
}

const HASH = 'ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12';
const action = (coopname = config.coopname) => ({ data: { coopname, username: 'teach', type: 'eduacptrid', hash: HASH } }) as any;
const agendaUrl = `${config.frontend_url}/${config.coopname}/soviet/agenda`;

describe('оповещение совету о новом вопросе', () => {
  it('ведёт на страницу вопроса: номер найден по хэшу без учёта регистра, оповещены председатель и член совета', async () => {
    const { service, notificationPort } = make([{ id: 4, hash: 'ff'.repeat(32) }, { id: 5, hash: HASH.toUpperCase() }]);
    await service.handleCreateAgenda(action());
    expect(notificationPort.notify).toHaveBeenCalledTimes(2);
    const { payload } = notificationPort.notify.mock.calls[0][0];
    expect(payload).toMatchObject({ agendaUrl: `${agendaUrl}/5`, decision_id: '5', itemTitle: '№5', authorName: 'Иванов Иван Иванович' });
  });

  it('вопроса в таблице решений нет — ссылка ведёт на повестку целиком', async () => {
    const { service, notificationPort } = make([{ id: 4, hash: 'ff'.repeat(32) }]);
    await service.handleCreateAgenda(action());
    expect(notificationPort.notify.mock.calls[0][0].payload.agendaUrl).toBe(agendaUrl);
  });

  it('цепь не ответила — оповещение уходит со ссылкой на повестку', async () => {
    const { service, notificationPort } = make(new Error('узел недоступен'));
    await service.handleCreateAgenda(action());
    expect(notificationPort.notify).toHaveBeenCalledTimes(2);
    expect(notificationPort.notify.mock.calls[0][0].payload.agendaUrl).toBe(agendaUrl);
  });

  it('вопрос чужого кооператива не оповещает и цепь не читает', async () => {
    const { service, notificationPort, sovietPort } = make([{ id: 5, hash: HASH }]);
    await service.handleCreateAgenda(action('othercoop'));
    expect(notificationPort.notify).not.toHaveBeenCalled();
    expect(sovietPort.getDecisions).not.toHaveBeenCalled();
  });
});
