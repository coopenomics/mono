/**
 * Записи мимо подписчика базы узла сами шлют сигнал ленты изменений.
 *
 * Инварианты:
 *   - запись и удаление личных данных, способов оплаты, пользовательских данных и
 *     переменных кооператива в генераторе — сигнал по своей таблице ленты со
 *     строкой (владелец — username);
 *   - прочие коллекции генератора (документы, проекты) — тишина;
 *   - без ленты (узел без сервиса) — запись проходит, ошибок нет.
 */
import { GeneratorInfrastructureService } from '~/infrastructure/generator/generator.service';

function feed() {
  return { publishLocal: jest.fn().mockResolvedValue(undefined) } as any;
}

describe('Генератор: записи в MongoDB', () => {
  function build(chainChanges: any) {
    const service = new GeneratorInfrastructureService({} as any, chainChanges);
    (service as any).generator = { save: jest.fn().mockResolvedValue(undefined), del: jest.fn().mockResolvedValue(undefined) };
    return service;
  }

  it.each([
    ['individual', 'private_accounts'],
    ['organization', 'private_accounts'],
    ['entrepreneur', 'private_accounts'],
    ['paymentMethod', 'payment_methods'],
    ['udata', 'user_data'],
  ])('save %s — сигнал по %s владельцу', async (collection, table) => {
    const chainChanges = feed();
    const data = { username: 'ivan', first_name: 'Иван' };

    await build(chainChanges).save(collection, data);

    expect(chainChanges.publishLocal).toHaveBeenCalledWith(table, 'ivan', data);
  });

  it('del способа оплаты — сигнал по payment_methods', async () => {
    const chainChanges = feed();
    const query = { username: 'ivan', method_id: '1' };

    await build(chainChanges).del('paymentMethod', query);

    expect(chainChanges.publishLocal).toHaveBeenCalledWith('payment_methods', 'ivan', query);
  });

  it('переменные кооператива — сигнал по coop_vars', async () => {
    const chainChanges = feed();

    await build(chainChanges).save('vars', { coopname: 'voskhod', name: 'Восход' });

    expect(chainChanges.publishLocal).toHaveBeenCalledWith('coop_vars', 'voskhod', { coopname: 'voskhod', name: 'Восход' });
  });

  it('прочие коллекции — тишина; без ленты — ошибок нет', async () => {
    const chainChanges = feed();

    await build(chainChanges).save('project', { hash: 'p1' });
    await expect(build(null).save('individual', { username: 'ivan' })).resolves.toBeUndefined();

    expect(chainChanges.publishLocal).not.toHaveBeenCalled();
  });
});
