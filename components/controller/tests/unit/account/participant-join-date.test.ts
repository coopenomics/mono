/**
 * Дата вступления пайщика в базе узла — для серверной сортировки реестра.
 *
 * Сама дата живёт в цепи: новым пайщикам её пишет приёмник решения совета
 * (soviet::addpartcpnt), принятым раньше — дочитка из цепи при старте узла.
 */
import config from '~/config/config';
import {
  ParticipantStatusSyncService,
  chainTimeToDate,
} from '~/domain/account/services/participant-status-sync.service';
import { userStatus } from '~/types/user.types';

function makeLogger() {
  return { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeService(options: {
  users?: Record<string, { status: string }>;
  withoutJoinedAt?: string[];
  participants?: Record<string, { created_at: string } | null>;
  chainFails?: boolean;
} = {}) {
  const repo = {
    findByUsername: jest.fn(async (username: string) => options.users?.[username] ?? null),
    updateByUsername: jest.fn(async () => null),
    setJoinedAt: jest.fn(async () => undefined),
    findUsernamesWithoutJoinedAt: jest.fn(async () => options.withoutJoinedAt ?? []),
  };
  const chain = {
    getParticipantAccount: jest.fn(async (_coop: string, username: string) => {
      if (options.chainFails) throw new Error('chain down');
      return options.participants?.[username] ?? null;
    }),
  };
  const service = new ParticipantStatusSyncService(makeLogger(), repo as any, chain as any);
  return { service, repo, chain };
}

const acceptEvent = (username: string, block_time?: string) =>
  ({ data: { coopname: config.coopname, username }, block_time } as any);

describe('chainTimeToDate', () => {
  it('время цепи без пояса читается как UTC', () => {
    expect(chainTimeToDate('2026-09-17T11:30:09')?.toISOString()).toBe('2026-09-17T11:30:09.000Z');
  });

  it('время с поясом не сдвигается', () => {
    expect(chainTimeToDate('2026-09-17T11:30:09.500Z')?.toISOString()).toBe('2026-09-17T11:30:09.500Z');
    expect(chainTimeToDate('2026-09-17T14:30:09+03:00')?.toISOString()).toBe('2026-09-17T11:30:09.000Z');
  });

  it('пусто и мусор — null', () => {
    expect(chainTimeToDate(undefined)).toBeNull();
    expect(chainTimeToDate('')).toBeNull();
    expect(chainTimeToDate('не дата')).toBeNull();
    expect(chainTimeToDate(123)).toBeNull();
  });
});

describe('ParticipantStatusSyncService: дата вступления при решении совета', () => {
  it('пишет время блока и поднимает статус', async () => {
    const { service, repo } = makeService({ users: { alice: { status: userStatus['4_Registered'] } } });

    await service.handleAddParticipant(acceptEvent('alice', '2026-09-17T11:30:09'));

    expect(repo.setJoinedAt).toHaveBeenCalledWith('alice', new Date('2026-09-17T11:30:09Z'));
    expect(repo.updateByUsername).toHaveBeenCalledWith('alice', { status: userStatus['5_Active'] });
  });

  it('уже активному тоже пишет дату (статус не трогает)', async () => {
    const { service, repo } = makeService({ users: { alice: { status: userStatus['5_Active'] } } });

    await service.handleAddParticipant(acceptEvent('alice', '2026-09-17T11:30:09'));

    expect(repo.setJoinedAt).toHaveBeenCalledTimes(1);
    expect(repo.updateByUsername).not.toHaveBeenCalled();
  });

  it('без времени блока берёт текущее время', async () => {
    const { service, repo } = makeService({ users: { alice: { status: userStatus['4_Registered'] } } });
    const before = Date.now();

    await service.handleAddParticipant(acceptEvent('alice'));

    const written = (repo.setJoinedAt.mock.calls[0] as any[])[1] as Date;
    expect(written.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('чужой кооператив и неизвестный пайщик — ничего не пишет', async () => {
    const { service, repo } = makeService({ users: {} });

    await service.handleAddParticipant({ data: { coopname: 'other', username: 'alice' } } as any);
    await service.handleAddParticipant(acceptEvent('ghost', '2026-09-17T11:30:09'));

    expect(repo.setJoinedAt).not.toHaveBeenCalled();
  });
});

describe('ParticipantStatusSyncService.backfillJoinedAt', () => {
  it('дочитывает дату только тем, кто принят в цепи', async () => {
    const { service, repo } = makeService({
      withoutJoinedAt: ['alice', 'pending', 'bob'],
      participants: {
        alice: { created_at: '2026-09-09T06:30:22' },
        pending: null,
        bob: { created_at: '2025-01-15T10:00:00' },
      },
    });

    const filled = await service.backfillJoinedAt();

    expect(filled).toBe(2);
    expect(repo.setJoinedAt).toHaveBeenCalledWith('alice', new Date('2026-09-09T06:30:22Z'));
    expect(repo.setJoinedAt).toHaveBeenCalledWith('bob', new Date('2025-01-15T10:00:00Z'));
    expect(repo.setJoinedAt).not.toHaveBeenCalledWith('pending', expect.anything());
  });

  it('читает цепь порциями — все аккаунты обработаны', async () => {
    const usernames = Array.from({ length: 19 }, (_, i) => `user${i}`);
    const participants = Object.fromEntries(usernames.map((u) => [u, { created_at: '2026-09-01T00:00:00' }]));
    const { service, chain } = makeService({ withoutJoinedAt: usernames, participants });

    expect(await service.backfillJoinedAt()).toBe(19);
    expect(chain.getParticipantAccount).toHaveBeenCalledTimes(19);
  });

  it('цепь недоступна — не падает, возвращает 0', async () => {
    const { service, repo } = makeService({ withoutJoinedAt: ['alice'], chainFails: true });

    await expect(service.backfillJoinedAt()).resolves.toBe(0);
    expect(repo.setJoinedAt).not.toHaveBeenCalled();
  });
});
