import { RedisRecoveryTokenStore } from './redis-recovery-token.store';

describe('RedisRecoveryTokenStore (Story 3.1)', () => {
  function setup() {
    const publisher = { set: jest.fn().mockResolvedValue('OK'), get: jest.fn(), eval: jest.fn() };
    const store = new RedisRecoveryTokenStore({ publisher } as never);
    return { store, publisher };
  }

  const payload = { subjectId: 'u1', username: 'ant', coopname: 'voskhod' };

  it('issue: пишет JSON под ключом coopid:recovery:<token> с PX=ttl*1000', async () => {
    const { store, publisher } = setup();
    await store.issue('tok-1', payload, 300);
    expect(publisher.set).toHaveBeenCalledWith(
      'coopid:recovery:tok-1',
      JSON.stringify(payload),
      'PX',
      300000,
    );
  });

  it('peek: неразрушающее GET (без DEL/eval), парсит payload', async () => {
    const { store, publisher } = setup();
    publisher.get.mockResolvedValueOnce(JSON.stringify(payload));
    const got = await store.peek('tok-1');
    expect(publisher.get).toHaveBeenCalledWith('coopid:recovery:tok-1');
    expect(publisher.eval).not.toHaveBeenCalled();
    expect(got).toEqual(payload);
  });

  it('peek: токена нет → null', async () => {
    const { store, publisher } = setup();
    publisher.get.mockResolvedValueOnce(null);
    expect(await store.peek('gone')).toBeNull();
  });

  it('consume: атомарный GETDEL через eval, парсит payload', async () => {
    const { store, publisher } = setup();
    publisher.eval.mockResolvedValueOnce(JSON.stringify(payload));
    const got = await store.consume('tok-1');
    expect(publisher.eval).toHaveBeenCalledWith(expect.any(String), 1, 'coopid:recovery:tok-1');
    expect(got).toEqual(payload);
  });

  it('consume: токена нет/истёк → null', async () => {
    const { store, publisher } = setup();
    publisher.eval.mockResolvedValueOnce(null);
    expect(await store.consume('gone')).toBeNull();
  });

  it('consume: битый JSON → null (не бросает)', async () => {
    const { store, publisher } = setup();
    publisher.eval.mockResolvedValueOnce('{not-json');
    expect(await store.consume('tok-1')).toBeNull();
  });
});
