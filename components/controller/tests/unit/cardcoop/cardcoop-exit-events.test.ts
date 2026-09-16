import { CardcoopExitEventsService } from '~/extensions/cardcoop/membership/exit-events.service';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

/**
 * Обработка событий выхода из кооператива (story 7.3).
 *
 * Узел видит действия всей цепи, а свидетельствует кооператив только о своих
 * пайщиках: без проверки кооператива чужой выход отозвал бы наше подтверждение.
 */
const logger = { setContext: () => undefined, info: () => undefined, warn: jest.fn(), error: jest.fn(), log: () => undefined };

const membership = {
  rememberExit: jest.fn(async () => undefined),
  forgetExit: jest.fn(async () => undefined),
  revokeByCompletedExit: jest.fn(async () => undefined),
};

const extension = { config: { api_url: 'https://card.coop' } };

const service = () => new CardcoopExitEventsService(membership as any, extension as any, logger as any);

const action = (data: Record<string, unknown>) => ({ data }) as any;

describe('События выхода пайщика из кооператива', () => {
  beforeEach(() => jest.clearAllMocks());

  it('заявление о выходе запоминает пайщика — при завершении цепь назовёт только процесс', async () => {
    await service().handleExitRequested(action({ coopname: 'voskhod', username: 'ant', exit_hash: 'exit-1' }));

    expect(membership.rememberExit).toHaveBeenCalledWith('exit-1', 'ant', 'voskhod');
  });

  it('завершение выхода отзывает подтверждение по адресу сети из конфига', async () => {
    await service().handleExitCompleted(action({ coopname: 'voskhod', exit_hash: 'exit-1' }));

    expect(membership.revokeByCompletedExit).toHaveBeenCalledWith('https://card.coop', 'exit-1');
  });

  it('отклонённое советом заявление просто забывается', async () => {
    await service().handleExitDeclined(action({ coopname: 'voskhod', exit_hash: 'exit-1' }));

    expect(membership.forgetExit).toHaveBeenCalledWith('exit-1');
    expect(membership.revokeByCompletedExit).not.toHaveBeenCalled();
  });

  it('выход в ЧУЖОМ кооперативе игнорируется — узел видит всю цепь', async () => {
    const worker = service();

    await worker.handleExitRequested(action({ coopname: 'other', username: 'bob', exit_hash: 'exit-9' }));
    await worker.handleExitCompleted(action({ coopname: 'other', exit_hash: 'exit-9' }));
    await worker.handleExitDeclined(action({ coopname: 'other', exit_hash: 'exit-9' }));

    expect(membership.rememberExit).not.toHaveBeenCalled();
    expect(membership.revokeByCompletedExit).not.toHaveBeenCalled();
    expect(membership.forgetExit).not.toHaveBeenCalled();
  });

  it('действие без обязательных полей не роняет обработчик', async () => {
    const worker = service();

    await worker.handleExitRequested(action({ coopname: 'voskhod' }));
    await worker.handleExitCompleted(action({ coopname: 'voskhod' }));

    expect(membership.rememberExit).not.toHaveBeenCalled();
    expect(membership.revokeByCompletedExit).not.toHaveBeenCalled();
  });

  it('сбой при записи не пробрасывается наружу, но попадает в журнал — иначе он оборвал бы разбор события', async () => {
    membership.rememberExit.mockRejectedValueOnce(new Error('база недоступна') as never);

    await expect(
      service().handleExitRequested(action({ coopname: 'voskhod', username: 'ant', exit_hash: 'exit-1' }))
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('база недоступна'));
  });
});
