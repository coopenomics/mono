/**
 * Unit-тесты `SovietBlockchainAdapter.ensureProgram` — самоинициализация ЦПП.
 *
 * Расширения (Стол заказов, Благорост) при старте сами открывают свою программу
 * в кооперативе. До этого программу заводили руками через cleos на каждый
 * кооператив, и «Восход» на тестнете приехал без неё: подписать оферту было
 * нельзя (`wallet::signagree` требует существующую программу), а стол при этом
 * показывал её уже подписанной (инцидент 2026-08-10).
 *
 * Ключевое требование — идемпотентность: `initialize()` расширения вызывается
 * на каждом старте и рестарте, повторный вызов не должен слать транзакцию и не
 * должен падать.
 */
import { SovietBlockchainAdapter } from '~/infrastructure/blockchain/adapters/soviet-blockchain.adapter';

const MARKETPLACE_TYPE = 'marketplace';
const MARKETPLACE_PROGRAM_ID = 2;

const makeCoagreement = (type: string, program_id: number) => ({
  type,
  coopname: 'voskhod',
  program_id,
  draft_id: 1102,
});

/**
 * `getAllRows` обслуживает и coagreements, и programs — различаем по имени
 * таблицы. `rowsByCall` позволяет отдать разные наборы до и после createprog.
 */
const makeBlockchainService = (coagreementSets: any[][]) => {
  let call = 0;
  return {
    getAllRows: jest.fn().mockImplementation((_code: string, _scope: string, table: string) => {
      if (table !== 'coagreements') return Promise.resolve([]);
      const set = coagreementSets[Math.min(call, coagreementSets.length - 1)];
      call += 1;
      return Promise.resolve(set);
    }),
    initialize: jest.fn(),
    transact: jest.fn().mockResolvedValue({ transaction_id: 'deadbeef' }),
  } as any;
};

const makeVault = (wif: string | null = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3') =>
  ({
    getWif: jest.fn().mockResolvedValue(wif),
  } as any);

describe('SovietBlockchainAdapter.ensureProgram', () => {
  it('программа уже открыта → транзакция не отправляется', async () => {
    const chain = makeBlockchainService([[makeCoagreement(MARKETPLACE_TYPE, MARKETPLACE_PROGRAM_ID)]]);
    const vault = makeVault();
    const adapter = new SovietBlockchainAdapter(chain, vault);

    const result = await adapter.ensureProgram({
      coopname: 'voskhod',
      type: MARKETPLACE_TYPE,
      title: 'Целевая потребительская программа «Стол заказов»',
    });

    expect(result).toEqual({ created: false, program_id: MARKETPLACE_PROGRAM_ID });
    expect(chain.transact).not.toHaveBeenCalled();
    // Ключ кооператива не запрашивается вовсе — читать чужой vault без нужды нельзя.
    expect(vault.getWif).not.toHaveBeenCalled();
  });

  it('программы нет → createprog ключом кооператива, program_id перечитывается из цепи', async () => {
    const chain = makeBlockchainService([[], [makeCoagreement(MARKETPLACE_TYPE, MARKETPLACE_PROGRAM_ID)]]);
    const adapter = new SovietBlockchainAdapter(chain, makeVault());

    const result = await adapter.ensureProgram({
      coopname: 'voskhod',
      type: MARKETPLACE_TYPE,
      title: 'Целевая потребительская программа «Стол заказов»',
    });

    expect(result).toEqual({ created: true, program_id: MARKETPLACE_PROGRAM_ID });
    expect(chain.transact).toHaveBeenCalledTimes(1);

    const sent = chain.transact.mock.calls[0][0];
    expect(sent.name).toBe('createprog');
    // Подписывает и платит RAM сам кооператив: председатель для открытия
    // программы не нужен, `check_auth_or_fail` пропускает `has_auth(coopname)`.
    expect(sent.authorization).toEqual([{ actor: 'voskhod', permission: 'active' }]);
    expect(sent.data.username).toBe('voskhod');
    expect(sent.data.type).toBe(MARKETPLACE_TYPE);
    // Шаблон оферты параметром НЕ передаётся — его назначает контракт из своего
    // реестра ЦПП, чтобы кооператив не мог подставить произвольный документ.
    expect(sent.data).not.toHaveProperty('draft_id');
    // При `free` контракт требует нули и по проценту, и по фиксированному взносу.
    expect(sent.data.calculation_type).toBe('free');
    expect(sent.data.membership_percent_fee).toBe(0);
  });

  it('чужая программа в coagreements не считается своей', async () => {
    // В кооперативе открыт Благорост, Стола заказов нет — ensureProgram обязан
    // создать свою, а не принять чужую строку за существующую.
    const chain = makeBlockchainService([
      [makeCoagreement('capital', 4)],
      [makeCoagreement('capital', 4), makeCoagreement(MARKETPLACE_TYPE, MARKETPLACE_PROGRAM_ID)],
    ]);
    const adapter = new SovietBlockchainAdapter(chain, makeVault());

    const result = await adapter.ensureProgram({
      coopname: 'voskhod',
      type: MARKETPLACE_TYPE,
      title: 'Целевая потребительская программа «Стол заказов»',
    });

    expect(result.created).toBe(true);
    expect(result.program_id).toBe(MARKETPLACE_PROGRAM_ID);
  });

  it('нет ключа кооператива → отказ, транзакция не отправляется', async () => {
    const chain = makeBlockchainService([[]]);
    const adapter = new SovietBlockchainAdapter(chain, makeVault(null));

    await expect(
      adapter.ensureProgram({
        coopname: 'voskhod',
        type: MARKETPLACE_TYPE,
        title: 'Целевая потребительская программа «Стол заказов»',
      })
    ).rejects.toThrow();
    expect(chain.transact).not.toHaveBeenCalled();
  });
});
