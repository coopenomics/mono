import { RobotDecisionKyselyRepository } from '~/extensions/soviet-robot/infrastructure/repositories/robot-decision.kysely-repository';
import { RobotKeyKyselyRepository } from '~/extensions/soviet-robot/infrastructure/repositories/robot-key.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

const ROW = {
  id: 'd1',
  coopname: 'voskhod',
  decision_id: 7,
  decision_type: 'joincoop',
  decision_hash: 'ab'.repeat(32),
  username: 'ant',
  stage: 'voting',
  votes: [],
  waiting_for: ['chairman'],
  protocol_hash: null,
  tx_hashes: [],
  last_error: null,
  attempts: 0,
  next_attempt_at: null,
  created_at: new Date('2026-10-04T00:00:00Z'),
  updated_at: new Date('2026-10-04T00:00:00Z'),
};

const repository = (results: Parameters<typeof recordingKysely>[0] = []) => {
  const { db, queries } = recordingKysely(results);
  return { decisions: new RobotDecisionKyselyRepository(db as never), keys: new RobotKeyKyselyRepository(db as never), queries };
};

/** Хранилище решений робота совета: что уходит в базу. */
describe('RobotDecisionKyselyRepository', () => {
  it('решение заводится один раз: при гонке двух доставок проигравший перечитывает запись победителя', async () => {
    // Вставка пропущена уникальным индексом (строк не вернулось), затем чтение.
    const { decisions, queries } = repository([{ rows: [] }, { rows: [ROW] }]);

    const created = await decisions.createIfAbsent({
      coopname: 'voskhod',
      decision_id: 7,
      decision_type: 'joincoop',
      decision_hash: ROW.decision_hash,
      username: 'ant',
      stage: 'voting' as never,
    });

    expect(queries[0].sql).toContain('insert into "soviet_robot_decisions"');
    expect(queries[0].sql).toContain('on conflict do nothing returning *');
    expect(queries[1].sql).toContain('where "coopname" = $1 and "decision_id" = $2');
    expect(created.id).toBe('d1');
  });

  it('к обработке берутся решения нужной стадии, у которых время повтора пусто или наступило; по номеру решения', async () => {
    const { decisions, queries } = repository();
    const now = new Date('2026-10-04T12:00:00Z');

    await decisions.findDue('voskhod', ['voting', 'authorizing'] as never, now, 20);

    expect(queries[0].sql).toContain('"coopname" = $1 and "stage" in ($2, $3)');
    expect(queries[0].sql).toContain('("next_attempt_at" is null or "next_attempt_at" <= $4)');
    expect(queries[0].sql).toContain('order by "decision_id" asc limit $5');
    expect(queries[0].parameters).toEqual(['voskhod', 'voting', 'authorizing', now, 20]);
  });

  it('пустой перечень стадий базу не спрашивает', async () => {
    const { decisions, queries } = repository();
    expect(await decisions.findDue('voskhod', [], new Date(), 20)).toEqual([]);
    expect(queries).toEqual([]);
  });

  it('список: сортировка только по своей колонке, чужое поле и подзапрос заменяются номером решения', async () => {
    const { decisions, queries } = repository([{ rows: [] }, { rows: [{ count: '0' }] }, { rows: [] }, { rows: [{ count: '0' }] }]);

    await decisions.findPaginated('voskhod', { page: 2, limit: 10, sortBy: 'stage', sortOrder: 'ASC' });
    await decisions.findPaginated('voskhod', { page: 1, limit: 10, sortBy: 'stage; drop table x', sortOrder: 'ASC' });

    expect(queries[0].sql).toContain('order by "stage" asc limit $2 offset $3');
    expect(queries[0].parameters).toEqual(['voskhod', 10, 10]);
    expect(queries[2].sql).toContain('order by "decision_id" asc');
  });

  it('ключ члена совета: повторная передача заменяет прежний, а не заводит второй', async () => {
    const key = { id: 'k1', coopname: 'voskhod', member: 'ant', permission_name: 'robot', encrypted_wif: 'x', public_key: 'PUB_1' };
    const { keys, queries } = repository([{ rows: [key] }, { rows: [{ ...key, public_key: 'PUB_2' }] }]);

    const saved = await keys.upsert({ coopname: 'voskhod', member: 'ant', permission_name: 'robot', encrypted_wif: 'y', public_key: 'PUB_2' });

    expect(queries[1].sql).toContain('update "soviet_robot_keys" set');
    expect(queries[1].sql).toContain('where "id" = $4');
    expect(saved.public_key).toBe('PUB_2');
  });
});
