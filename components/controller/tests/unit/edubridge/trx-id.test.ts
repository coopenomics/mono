/** Ключ задачи доступа: номер транзакции в одном виде у службы и у слушателя цепи. */
import { chainTrigger, trxIdOf } from '~/extensions/edubridge/domain/lib/trx-id';

describe('trxIdOf — номер транзакции из ответа цепи', () => {
  it('берёт номер из ответа узла, из разобранной транзакции либо с верхнего уровня', () => {
    expect(trxIdOf({ response: { transaction_id: 'AB12' } })).toBe('ab12');
    expect(trxIdOf({ resolved: { transaction: { id: 'CD34' } } })).toBe('cd34');
    expect(trxIdOf({ transaction_id: 'EF56' })).toBe('ef56');
  });

  it('ответ без номера даёт пусто — вызывающий подставляет свой ключ', () => {
    expect(trxIdOf({})).toBeNull();
    expect(trxIdOf(undefined)).toBeNull();
    expect(trxIdOf({ response: {} })).toBeNull();
  });

  it('номер из действия цепи совпадает с номером службы независимо от регистра', () => {
    expect(chainTrigger('DF9C99A9')).toBe(trxIdOf({ response: { transaction_id: 'df9c99a9' } }));
  });
});
