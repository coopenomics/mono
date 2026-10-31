/** Уведомления пайщику по паевому взносу имуществом: заявление в совете, взнос принят. */
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', frontendUrl: 'https://desk.example' }),
}));
import { Workflows } from '@coopenomics/notifications';
import { ProgramPropertyNotificationListener } from '~/extensions/capital/application/listeners/program-property-notification.listener';

const HASH = 'ab'.repeat(32);

function setup(found: any = { username: 'ivan', property_amount: '10000.0000 RUB' }) {
  const repo = { findByStepHash: jest.fn(async () => found) } as any;
  const interactor = { positionOf: jest.fn(() => ({ property_name: 'Ноутбук LENOVO' })) } as any;
  const notifications = { notifyUser: jest.fn(async () => ({})) } as any;
  const logger = { setContext: jest.fn(), warn: jest.fn() } as any;
  return { repo, notifications, logger, listener: new ProgramPropertyNotificationListener(repo, interactor, notifications, logger) };
}

const action = (receiver = 'capital') => ({ account: 'capital', receiver, data: { property_hash: HASH } }) as any;

describe('Уведомления по взносу имуществом', () => {
  it('председатель одобрил заявление — пайщику «Заявление передано в совет» с наименованием и оценкой', async () => {
    const { listener, notifications, repo } = setup();
    await listener.onStatementApproved(action());

    expect(repo.findByStepHash).toHaveBeenCalledWith(HASH);
    expect(notifications.notifyUser).toHaveBeenCalledWith('ivan', Workflows.CapitalPropertyStatementApproved.id, {
      propertyName: 'Ноутбук LENOVO',
      amount: expect.stringMatching(/^10\s000,00 RUB$/),
      coopname: 'voskhod',
      deepLinkUrl: 'https://desk.example/voskhod/capital/contributions',
    });
  });

  it('председатель подписал акт — пайщику «Ваш взнос имуществом принят»', async () => {
    const { listener, notifications } = setup();
    await listener.onAccepted(action());
    expect(notifications.notifyUser).toHaveBeenCalledWith('ivan', Workflows.CapitalPropertyAccepted.id, expect.any(Object));
  });

  it('уведомление получателю того же действия повторно не шлёт', async () => {
    const { listener, notifications } = setup();
    await listener.onAccepted(action('ivan'));
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it('сбой отправки пишется в журнал и процесс не останавливает', async () => {
    const { listener, notifications, logger } = setup();
    notifications.notifyUser.mockRejectedValueOnce(new Error('недоступно'));
    await expect(listener.onAccepted(action())).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('взнос не найден — уведомления нет', async () => {
    const { listener, notifications } = setup(null);
    await listener.onStatementApproved(action());
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });
});
