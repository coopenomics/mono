/**
 * Созыв собрания, отвергнутый цепью.
 *
 * Данные собрания до цепи (meet_pre) пишутся раньше транзакции: их читают
 * обработчики блока созыва. До 25.09.2026 при отказе цепи строка оставалась
 * сиротой — собрания нет, а данные о нём в базе есть (C28-80, решение
 * владельца 25.09: такого быть не должно).
 */
import { MeetInteractor } from '~/application/meet/interactors/meet.interactor';

function build(createMeet: jest.Mock) {
  const rows = new Map<string, unknown>();
  const pre = {
    create: jest.fn(async (row: { hash: string }) => {
      rows.set(row.hash, row);
    }),
    deleteByHash: jest.fn(async (hash: string) => {
      rows.delete(hash);
    }),
    findByHash: jest.fn(async (hash: string) => rows.get(hash) ?? null),
  };
  const chain = { createMeet, getMeet: jest.fn(async () => null) };
  const aggregator = { buildDocumentAggregate: jest.fn(async () => null) };
  const interactor = new MeetInteractor({} as any, pre as any, {} as any, chain as any, aggregator as any);
  return { interactor, pre, rows };
}

const input = {
  coopname: 'voskhod',
  initiator: 'ant',
  presider: 'ant',
  secretary: 'ant',
  agenda: [{ title: 'Вопрос', context: '', decision: 'Решение' }],
  open_at: new Date('2026-10-20T00:00:00Z'),
  close_at: new Date('2026-10-21T00:00:00Z'),
  proposal: {},
} as any;

describe('созыв собрания, отвергнутый цепью', () => {
  it('отказ цепи уходит пайщику, строка собрания до цепи удаляется', async () => {
    const refusal = new Error('assertion failure with message: Дата открытия раньше срока');
    const m = build(jest.fn(async () => {
      throw refusal;
    }));

    await expect(m.interactor.createAnnualGeneralMeet(input)).rejects.toBe(refusal);

    const hash = m.pre.create.mock.calls[0][0].hash;
    expect(m.pre.deleteByHash).toHaveBeenCalledWith(hash);
    expect(m.rows.size).toBe(0);
  });

  it('цепь приняла созыв — строка остаётся', async () => {
    const m = build(jest.fn(async () => ({})));

    await m.interactor.createAnnualGeneralMeet(input);

    expect(m.pre.deleteByHash).not.toHaveBeenCalled();
    expect(m.rows.size).toBe(1);
  });
});
