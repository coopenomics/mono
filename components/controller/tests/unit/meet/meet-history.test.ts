import { createHash } from 'crypto';
import { MeetBlockchainAdapter } from '../../../src/infrastructure/blockchain/adapters/meet-blockchain.adapter';
import { ChainTextService } from '../../../src/domain/chain-text/chain-text.service';

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

const document = {
  version: '1',
  hash: 'A'.repeat(64),
  doc_hash: 'A'.repeat(64),
  meta_hash: 'A'.repeat(64),
  meta: '{}',
  signatures: [],
};

function meetRow(id: number, hash: string, status: string) {
  return {
    id,
    hash,
    coopname: 'voskhod',
    type: 'regular',
    level: 'cooperative',
    initiator: 'ant',
    presider: 'ant',
    secretary: 'ant',
    status,
    created_at: '2026-09-01T00:00:00',
    open_at: '2026-09-02T00:00:00',
    close_at: '2026-09-03T00:00:00',
    quorum_percent: 50,
    signed_ballots: 2,
    current_quorum_percent: 100,
    cycle: 1,
    quorum_passed: true,
    notified_users: [],
    proposal: document,
    authorization: document,
    decision1: document,
    decision2: document,
  };
}

function questionRow(id: number, meetId: number, number: number, title: string) {
  return {
    id,
    number,
    coopname: 'voskhod',
    meet_id: meetId,
    title: sha(title),
    context: '',
    decision: sha('Утвердить'),
    counter_votes_for: 2,
    counter_votes_against: 0,
    counter_votes_abstained: 0,
    voters_for: ['ant', 'kdy'],
    voters_against: [],
    voters_abstained: [],
  };
}

/**
 * Закрытое собрание контракт стирает целиком (C28-78). На столе оно остаётся:
 * адаптер берёт его последнее состояние из журнала дельт, а формулировки
 * вопросов — из хранилища текстов.
 */
describe('MeetBlockchainAdapter — закрытые собрания из журнала дельт', () => {
  const texts = new Map<string, string>([
    [sha('Утвердить отчёт'), 'Утвердить отчёт'],
    [sha('Избрать совет'), 'Избрать совет'],
    [sha('Утвердить'), 'Утвердить'],
  ]);
  const chainTextService = new ChainTextService({
    saveMany: jest.fn(),
    findByDigests: async (digests: string[]) => new Map(digests.filter((d) => texts.has(d)).map((d) => [d, texts.get(d) as string])),
  });

  const closedHash = 'C'.repeat(64);
  const declinedHash = 'D'.repeat(64);
  const liveHash = 'E'.repeat(64);

  const findLatestRows = jest.fn(async (filters: { table: string }, where: Record<string, string> = {}) => {
    if (filters.table === 'meets') {
      const rows = [
        { primary_key: '1', value: meetRow(1, closedHash, 'closed'), present: false, block_num: 10 },
        // Отклонённое собрание тоже стёрто, но закрытым не было.
        { primary_key: '2', value: meetRow(2, declinedHash, 'created'), present: false, block_num: 11 },
        // Живое собрание — его дельта последняя и присутствующая.
        { primary_key: '3', value: meetRow(3, liveHash, 'authorized'), present: true, block_num: 12 },
      ];
      return where.hash ? rows.filter((r) => r.value.hash.toLowerCase() === where.hash.toLowerCase()) : rows;
    }
    if (where.meet_id === '1') {
      return [
        { primary_key: '11', value: questionRow(11, 1, 2, 'Избрать совет'), present: false, block_num: 10 },
        { primary_key: '10', value: questionRow(10, 1, 1, 'Утвердить отчёт'), present: false, block_num: 10 },
      ];
    }
    return [];
  });

  const getSingleRow = jest.fn();
  const getAllRows = jest.fn();
  const query = jest.fn(async () => []);

  const adapter = new MeetBlockchainAdapter(
    { getSingleRow, getAllRows, query } as any,
    {} as any,
    {} as any,
    chainTextService,
    { findLatestRows } as any
  );

  beforeEach(() => {
    getSingleRow.mockReset();
    getAllRows.mockReset();
  });

  it('собрание, стёртое при закрытии, читается из журнала с текстами вопросов по порядку', async () => {
    getSingleRow.mockResolvedValue(null);

    const meet = await adapter.getMeet({ coopname: 'voskhod', hash: closedHash, username: 'kdy' });

    expect(meet?.meet.status).toBe('closed');
    expect(meet?.questions.map((q) => [q.number, q.title, q.decision])).toEqual([
      [1, 'Утвердить отчёт', 'Утвердить'],
      [2, 'Избрать совет', 'Утвердить'],
    ]);
    expect(meet?.isVoted).toBe(true);
  });

  it('сразу после подписи протокола дельта стирания ещё не дошла — собрание берётся по последней дельте «closed»', async () => {
    getSingleRow.mockResolvedValue(null);
    findLatestRows.mockImplementationOnce(async () => [
      { primary_key: '1', value: meetRow(1, closedHash, 'closed'), present: true, block_num: 10 },
    ]);

    const meet = await adapter.getMeet({ coopname: 'voskhod', hash: closedHash });

    expect(meet?.meet.status).toBe('closed');
  });

  it('отклонённое и стёртое собрание не находится, как и раньше', async () => {
    getSingleRow.mockResolvedValue(null);
    expect(await adapter.getMeet({ coopname: 'voskhod', hash: declinedHash })).toBeNull();
  });

  it('список: живые собрания из цепи плюс закрытые из журнала, без повторов', async () => {
    getAllRows.mockResolvedValue([meetRow(3, liveHash, 'authorized')]);

    const meets = await adapter.getMeets({ coopname: 'voskhod' });

    expect(meets.map((m) => [m.meet.id, m.meet.status])).toEqual([
      [3, 'authorized'],
      [1, 'closed'],
    ]);
  });

  it('закрытое собрание, которое ещё лежит в цепи, не дублируется журналом', async () => {
    getAllRows.mockResolvedValue([meetRow(1, closedHash.toLowerCase(), 'closed')]);

    const meets = await adapter.getMeets({ coopname: 'voskhod' });

    expect(meets.map((m) => m.meet.id)).toEqual([1]);
  });
});
