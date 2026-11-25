/**
 * Пояснение председателя к отклонению решения совета (решение владельца 25.11.2026).
 *
 * В цепи у отклонения по большинству «против» одна общая фраза. Председатель
 * может пояснить отказ: пояснение хранится на узле, в цепь не пишется, и
 * расширение читает его по номеру решения, когда разбирает обратный вызов
 * отклонения. Поэтому сервер записывает пояснение ДО транзакции, а при
 * отказе цепи — сняться: иначе оно приписалось бы к будущему снятию вопроса по сроку.
 */
import { DecisionInteractor } from '~/application/decision/use-cases/decision.interactor';
import { DecisionDeclineReasonKyselyRepository } from '~/infrastructure/database/kysely/repositories/decision-decline-reason.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

function interactor(chainFails = false) {
  const calls: string[] = [];
  const reasons = {
    save: jest.fn(async () => {
      calls.push('save');
    }),
    remove: jest.fn(async () => {
      calls.push('remove');
    }),
    find: jest.fn(),
  };
  const chain = {
    declineDecision: jest.fn(async () => {
      calls.push('chain');
      if (chainFails) throw new Error('Решение не отклонено советом: нет большинства голосов против');
      return { id: 'tx' };
    }),
  };
  const sut = new DecisionInteractor(chain as never, {} as never, reasons as never);
  return { sut, reasons, chain, calls };
}

describe('dec.decline.happy.01: сервер записывает пояснение председателя в базу до транзакции', () => {
  it('сначала запись пояснения, затем declinedec; в цепь пояснение не передаётся', async () => {
    const { sut, reasons, chain, calls } = interactor();

    await sut.declineDecision({ coopname: 'voskhod', decision_id: 31, reason: '  Материалы не по теме занятия  ' }, 'ant');

    expect(calls).toEqual(['save', 'chain']);
    expect(reasons.save).toHaveBeenCalledWith('voskhod', 31, 'Материалы не по теме занятия', 'ant');
    expect(chain.declineDecision).toHaveBeenCalledWith({ coopname: 'voskhod', decision_id: 31 });
  });

  it('без пояснения ничего не пишется', async () => {
    const { sut, reasons, calls } = interactor();

    await sut.declineDecision({ coopname: 'voskhod', decision_id: 31, reason: '   ' });

    expect(reasons.save).not.toHaveBeenCalled();
    expect(calls).toEqual(['chain']);
  });
});

describe('dec.decline.side.01: цепь отказала — пояснение снимается', () => {
  it('ошибка цепи пробрасывается, пояснение удалено', async () => {
    const { sut, reasons, calls } = interactor(true);

    await expect(sut.declineDecision({ coopname: 'voskhod', decision_id: 31, reason: 'причина' })).rejects.toThrow('нет большинства');

    expect(calls).toEqual(['save', 'chain', 'remove']);
    expect(reasons.remove).toHaveBeenCalledWith('voskhod', 31);
  });
});

describe('dec.decline.happy.02: хранилище пояснений', () => {
  it('запись — вставка с заменой по (coopname, decision_id)', async () => {
    const { db, queries } = recordingKysely([{}]);
    const repo = new DecisionDeclineReasonKyselyRepository(db as never);

    await repo.save('voskhod', 31, 'причина', 'ant');

    expect(queries[0].sql).toContain('insert into "decision_decline_reasons"');
    expect(queries[0].sql).toContain('on conflict ("coopname", "decision_id") do update set');
    expect(queries[0].parameters).toEqual(expect.arrayContaining(['voskhod', 31, 'причина', 'ant']));
  });

  it('порт отдаёт пояснение по номеру решения либо null', async () => {
    const { db, queries } = recordingKysely([{ rows: [{ reason: 'причина' }] }, { rows: [] }]);
    const repo = new DecisionDeclineReasonKyselyRepository(db as never);

    await expect(repo.getDeclineReason('voskhod', '31')).resolves.toBe('причина');
    await expect(repo.getDeclineReason('voskhod', 32)).resolves.toBeNull();

    expect(queries[0].sql).toMatch(/where "coopname" = \$1 and "decision_id" = \$2/);
    expect(queries[1].parameters).toEqual(['voskhod', '32']);
  });
});
