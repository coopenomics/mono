import { LoanTermSchedulerService } from './loan-term-scheduler.service';
import { LoanStatus } from '../../domain/enums/loan-status.enum';

jest.mock('@coopenomics/extension-kit', () => ({
  AmountFormatterUtils: { formatAmountSafe: (value: string) => value },
  platformSettings: () => ({ coopname: 'voskhod', frontendUrl: 'https://coop.test' }),
}));

jest.mock('@coopenomics/notifications', () => ({
  Workflows: { LoanDueSoon: { id: 'loan-due-soon' } },
}));

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const chain = (ms: number) => new Date(ms).toISOString().slice(0, 19);

interface LoanStub {
  debt_hash: string;
  username: string;
  amount: string;
  remaining: string;
  due_at: string;
  overdue_at: string;
  isOwn: boolean;
}

function loan(patch: Partial<LoanStub>): LoanStub {
  return {
    debt_hash: 'ab12cd34'.padEnd(64, '0'),
    username: 'ant',
    amount: '1000.0000 RUB',
    remaining: '1000.0000 RUB',
    due_at: chain(NOW + 30 * DAY),
    overdue_at: '1970-01-01T00:00:00',
    isOwn: true,
    ...patch,
  };
}

describe('LoanTermSchedulerService', () => {
  let byStatus: Record<string, LoanStub[]>;
  let loans: { findByStatus: jest.Mock };
  let chainPort: { sweep: jest.Mock };
  let notifications: { notifyUser: jest.Mock };
  let service: LoanTermSchedulerService;

  beforeEach(() => {
    byStatus = { [LoanStatus.ISSUED]: [], [LoanStatus.OVERDUE]: [] };
    loans = { findByStatus: jest.fn(async (_coop: string, status: string) => byStatus[status] ?? []) };
    chainPort = { sweep: jest.fn().mockResolvedValue({}) };
    notifications = { notifyUser: jest.fn().mockResolvedValue({}) };
    service = new LoanTermSchedulerService(loans as any, chainPort as any, notifications as any);
  });

  describe('сверка цепи', () => {
    it('цепь не зовётся, пока сроки не истекли', async () => {
      byStatus[LoanStatus.ISSUED] = [loan({})];
      expect(await service.sweep('voskhod', NOW)).toBe(0);
      expect(chainPort.sweep).not.toHaveBeenCalled();
    });

    it('заём с истёкшим сроком уходит в цепь одним вызовом', async () => {
      byStatus[LoanStatus.ISSUED] = [loan({ due_at: chain(NOW - DAY) })];
      expect(await service.sweep('voskhod', NOW)).toBe(1);
      expect(chainPort.sweep).toHaveBeenCalledWith({ coopname: 'voskhod', limit: 25 });
    });

    it('просрочка моложе пяти дней обеспечения не трогает', async () => {
      byStatus[LoanStatus.OVERDUE] = [loan({ due_at: chain(NOW - 4 * DAY), overdue_at: chain(NOW - 4 * DAY) })];
      expect(await service.sweep('voskhod', NOW)).toBe(0);
    });

    it('через пять дней просрочки зовёт цепь для обращения обеспечения', async () => {
      byStatus[LoanStatus.OVERDUE] = [loan({ due_at: chain(NOW - 6 * DAY), overdue_at: chain(NOW - 5 * DAY) })];
      expect(await service.sweep('voskhod', NOW)).toBe(1);
    });

    it('заём другого приложения остаётся в просрочке без обращения обеспечения', async () => {
      byStatus[LoanStatus.OVERDUE] = [
        loan({ isOwn: false, due_at: chain(NOW - 30 * DAY), overdue_at: chain(NOW - 20 * DAY) }),
      ];
      expect(await service.sweep('voskhod', NOW)).toBe(0);
    });

    it('число вызовов считается пачками по 25 и ограничено пределом раундов', async () => {
      byStatus[LoanStatus.ISSUED] = Array.from({ length: 60 }, () => loan({ due_at: chain(NOW - DAY) }));
      expect(await service.sweep('voskhod', NOW)).toBe(3);

      byStatus[LoanStatus.ISSUED] = Array.from({ length: 1000 }, () => loan({ due_at: chain(NOW - DAY) }));
      expect(await service.sweep('voskhod', NOW)).toBe(20);
    });
  });

  describe('напоминание о сроке', () => {
    it('уходит за 14 дней и ближе', async () => {
      byStatus[LoanStatus.ISSUED] = [loan({ due_at: chain(NOW + 10 * DAY) })];
      expect(await service.remindAboutUpcomingTerms('voskhod', NOW)).toBe(1);
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'ant',
        'loan-due-soon',
        expect.objectContaining({ contractNumber: 'AB12CD34', amount: '1000.0000 RUB' })
      );
    });

    it('раньше 14 дней и после срока не уходит', async () => {
      byStatus[LoanStatus.ISSUED] = [loan({ due_at: chain(NOW + 15 * DAY) }), loan({ due_at: chain(NOW - DAY) })];
      expect(await service.remindAboutUpcomingTerms('voskhod', NOW)).toBe(0);
    });

    it('содержимое не меняется день ото дня — центр уведомлений гасит повтор', async () => {
      byStatus[LoanStatus.ISSUED] = [loan({ due_at: chain(NOW + 10 * DAY) })];
      await service.remindAboutUpcomingTerms('voskhod', NOW);
      await service.remindAboutUpcomingTerms('voskhod', NOW + DAY);
      expect(notifications.notifyUser.mock.calls[0][2]).toEqual(notifications.notifyUser.mock.calls[1][2]);
    });

    it('сбой одного уведомления не останавливает остальные', async () => {
      byStatus[LoanStatus.ISSUED] = [loan({ due_at: chain(NOW + 5 * DAY) }), loan({ username: 'bob', due_at: chain(NOW + 6 * DAY) })];
      notifications.notifyUser.mockRejectedValueOnce(new Error('нет подписчика'));
      expect(await service.remindAboutUpcomingTerms('voskhod', NOW)).toBe(1);
    });
  });
});
