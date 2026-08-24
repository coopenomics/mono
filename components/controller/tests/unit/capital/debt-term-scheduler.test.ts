/**
 * Unit-тесты сверки сроков возврата займов.
 *
 * Что здесь защищается. Цепь за один вызов переводит в просрочку ограниченное
 * число займов и не сообщает, сколько осталось, — сколько раз её позвать,
 * считается по зеркалу. Ошибка в этом счёте оставляет часть займов
 * непереведёнными до следующих суток либо гоняет цепь вхолостую.
 *
 * Второе: у займов, выданных до появления срока возврата, срока нет вовсе —
 * такие в просрочку не переводятся и напоминаний по ним не шлётся.
 *
 * Реестр случаев: test-registry/capital.debt-lifecycle.yaml
 */

import { DebtTermSchedulerService } from '~/extensions/capital/infrastructure/services/debt-term-scheduler.service';
import { DebtStatus } from '~/extensions/capital/domain/enums/debt-status.enum';

jest.mock('@coopenomics/extension-kit', () => ({
  platformSettings: () => ({ coopname: 'voskhod' }),
  AmountFormatterUtils: { formatAmountSafe: (v: string) => v },
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function debt(overrides: Record<string, unknown>) {
  return {
    username: 'petrov',
    amount: '30000.0000 RUB',
    status: DebtStatus.PAID,
    ...overrides,
  } as any;
}

function makeScheduler(debts: any[]) {
  const byStatus = (status: string) => debts.filter((d) => d.status === status);

  const repository = {
    findByStatus: jest.fn(async (status: string) => byStatus(status)),
  } as any;

  const chain = {
    markOverdueDebts: jest.fn(async () => ({ transaction: { ref_block_num: 1 } })),
  } as any;

  const notifications = {
    notifyUser: jest.fn(async () => ({ outboxIds: [] })),
  } as any;

  return {
    scheduler: new DebtTermSchedulerService(repository, chain, notifications),
    chain,
    notifications,
  };
}

describe('Сверка сроков возврата займов', () => {
  it('займы с истёкшим сроком переводятся в просрочку', async () => {
    const expired = new Date(Date.now() - 10 * DAY_MS).toISOString();
    const { scheduler, chain } = makeScheduler([debt({ due_at: expired })]);

    await scheduler.tick();

    expect(chain.markOverdueDebts).toHaveBeenCalledWith({ coopname: 'voskhod' });
  });

  it('цепь вызывается столько раз, сколько нужно на все просроченные займы', async () => {
    const expired = new Date(Date.now() - DAY_MS).toISOString();
    const many = Array.from({ length: 60 }, () => debt({ due_at: expired }));
    const { scheduler, chain } = makeScheduler(many);

    await scheduler.tick();

    // За вызов цепь переводит не больше двадцати пяти займов.
    expect(chain.markOverdueDebts).toHaveBeenCalledTimes(3);
  });

  it('когда просроченных займов нет, цепь не тревожится', async () => {
    const future = new Date(Date.now() + 200 * DAY_MS).toISOString();
    const { scheduler, chain } = makeScheduler([debt({ due_at: future })]);

    await scheduler.tick();

    expect(chain.markOverdueDebts).not.toHaveBeenCalled();
  });

  it('заём без срока возврата в просрочку не переводится', async () => {
    const { scheduler, chain } = makeScheduler([debt({ due_at: undefined })]);

    await scheduler.tick();

    expect(chain.markOverdueDebts).not.toHaveBeenCalled();
  });

  it('о приближении срока пайщик получает напоминание', async () => {
    const soon = new Date(Date.now() + 5 * DAY_MS).toISOString();
    const { scheduler, notifications } = makeScheduler([debt({ due_at: soon })]);

    await scheduler.tick();

    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'petrov',
      expect.any(String),
      expect.objectContaining({ daysLeft: '5' })
    );
  });

  it('до срока ещё далеко — напоминание не шлётся', async () => {
    const far = new Date(Date.now() + 100 * DAY_MS).toISOString();
    const { scheduler, notifications } = makeScheduler([debt({ due_at: far })]);

    await scheduler.tick();

    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it('по просроченному займу пайщик получает уведомление', async () => {
    const expired = new Date(Date.now() - 3 * DAY_MS).toISOString();
    const { scheduler, notifications } = makeScheduler([
      debt({ due_at: expired, status: DebtStatus.OVERDUE }),
    ]);

    await scheduler.tick();

    expect(notifications.notifyUser).toHaveBeenCalledWith(
      'petrov',
      expect.any(String),
      expect.objectContaining({ amount: '30000.0000 RUB' })
    );
  });

  it('сбой цепи не роняет проход и не мешает следующему', async () => {
    const expired = new Date(Date.now() - DAY_MS).toISOString();
    const { scheduler, chain } = makeScheduler([debt({ due_at: expired })]);
    chain.markOverdueDebts.mockRejectedValueOnce(new Error('цепь недоступна'));

    await expect(scheduler.tick()).resolves.toBeUndefined();

    await scheduler.tick();
    expect(chain.markOverdueDebts).toHaveBeenCalledTimes(2);
  });
});
