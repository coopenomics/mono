import { isDeltaOwnedByCoop, isPlatformWideTable } from './delta-ownership';

/**
 * Отбор дельт «своё / чужое» — единственная защита базы узла от состояния
 * соседних кооперативов и одновременно единственное место, где можно молча
 * потерять собственные данные. Проверяем обе стороны этой границы.
 */
describe('принадлежность дельты кооперативу', () => {
  const coop = 'voskhod';

  it('строка со своим coopname принимается, с чужим — нет', () => {
    const own = { code: 'soviet', table: 'decisions', scope: 'soviet', value: { coopname: 'voskhod' } };
    const alien = { code: 'soviet', table: 'decisions', scope: 'soviet', value: { coopname: 'zakat' } };

    expect(isDeltaOwnedByCoop(own, coop)).toBe(true);
    expect(isDeltaOwnedByCoop(alien, coop)).toBe(false);
  });

  it('при отсутствии coopname владельцем считается scope', () => {
    expect(isDeltaOwnedByCoop({ code: 'ledger2', table: 'wallets', scope: 'voskhod', value: { id: 1 } }, coop)).toBe(
      true
    );
    expect(isDeltaOwnedByCoop({ code: 'ledger2', table: 'wallets', scope: 'zakat', value: { id: 1 } }, coop)).toBe(
      false
    );
  });

  it('пустой coopname (битый ABI) не проходит вместо scope', () => {
    const delta = { code: 'soviet', table: 'decisions', scope: 'voskhod', value: { coopname: '' } };
    expect(isDeltaOwnedByCoop(delta, coop)).toBe(true);
  });

  it('реестр шаблонов принимается независимо от кооператива', () => {
    expect(isPlatformWideTable('draft', 'drafts')).toBe(true);
    expect(isDeltaOwnedByCoop({ code: 'draft', table: 'drafts', scope: 'draft', value: {} }, coop)).toBe(true);
    expect(isDeltaOwnedByCoop({ code: 'draft', table: 'translations', scope: 'draft', value: {} }, coop)).toBe(true);
  });

  it('реестр кооперативов сети принимается по полю username — только своя строка', () => {
    const own = { code: 'registrator', table: 'coops', scope: 'registrator', value: { username: 'voskhod' } };
    const alien = { code: 'registrator', table: 'coops', scope: 'registrator', value: { username: 'zakat' } };

    expect(isDeltaOwnedByCoop(own, coop)).toBe(true);
    expect(isDeltaOwnedByCoop(alien, coop)).toBe(false);
    // Реестр сети не платформенный: чужие кооперативы узлу не нужны.
    expect(isPlatformWideTable('registrator', 'coops')).toBe(false);
  });

  it('прочие таблицы registrator живут по общему правилу', () => {
    const account = { code: 'registrator', table: 'accounts', scope: 'registrator', value: { username: 'voskhod' } };
    expect(isDeltaOwnedByCoop(account, coop)).toBe(false);
  });
});
