/**
 * Реестры Стола бухгалтера: собственные операции стола (C28-90, случаи
 * access.roles.happy.12 в test-registry/platform.access-roles.yaml).
 *
 * Данные ведёт ядро, стол берёт их через порты и отдаёт наружу без личных
 * данных пайщиков: реестрам нужно имя для показа и вид субъекта.
 */
import { ReportsRegistriesService } from '~/extensions/reports/application/services/registries.service';

const individual = (username: string, status: string, last: string) => ({
  username,
  account_kind: 'participant',
  participant_account: { status },
  private_account: { type: 'individual', individual_data: { last_name: last, first_name: 'Иван', middle_name: 'Иванович', passport: 'секрет' } },
});

function makeService(options: { accounts?: any[]; wallets?: any[] } = {}) {
  const registries = {
    ledgerAccounts: jest.fn(async () => [{ id: 1 }]),
    ledgerWallets: jest.fn(async () => [{ id: 'w' }]),
    ledgerHistory: jest.fn(async () => ({ items: [] })),
    ledgerPostings: jest.fn(async () => ({ items: [] })),
    process: jest.fn(async () => ({ process_hash: 'h' })),
    processes: jest.fn(async () => ({ items: [] })),
  };
  const all = options.accounts ?? [];
  const accounts = {
    getAccounts: jest.fn(async () => ({ items: all, totalCount: all.length, totalPages: 1, currentPage: 1 })),
    getAccount: jest.fn(async (username: string) => {
      const found = all.find((account) => account.username === username);
      if (!found) throw new Error('нет такой учётной записи');
      return found;
    }),
  };
  const programWallets = { getProgramWallets: jest.fn(async () => options.wallets ?? []) };
  return { service: new ReportsRegistriesService(registries as any, accounts as any, programWallets as any), registries, accounts, programWallets };
}

describe('реестры бухгалтерии и процессов', () => {
  it('стол отдаёт строки ядра как есть, с теми же отборами', async () => {
    const { service, registries } = makeService();
    expect(await service.ledgerAccounts('voskhod')).toEqual([{ id: 1 }]);
    expect(await service.ledgerWallets('voskhod')).toEqual([{ id: 'w' }]);
    const input = { coopname: 'voskhod', limit: 10 } as any;
    await service.ledgerHistory(input);
    await service.ledgerPostings(input);
    await service.process('h', 'voskhod');
    await service.processes({ coopname: 'voskhod' } as any, { page: 1, limit: 10 } as any);
    expect(registries.ledgerHistory).toHaveBeenCalledWith(input);
    expect(registries.ledgerPostings).toHaveBeenCalledWith(input);
    expect(registries.process).toHaveBeenCalledWith('h', 'voskhod');
    expect(registries.processes).toHaveBeenCalledWith({ coopname: 'voskhod' }, { page: 1, limit: 10 });
  });
});

describe('пайщики и субъекты в реестрах', () => {
  const ACCOUNTS = [
    individual('ivan', 'accepted', 'Иванов'),
    individual('cand', 'registered', 'Кандидатов'),
    { username: 'krg', account_kind: 'branch', participant_account: null, private_account: { type: 'organization', organization_data: { short_name: 'КУ Красногорск' } } },
    { username: 'bare', account_kind: 'participant', participant_account: { status: 'accepted' }, private_account: null },
  ];

  it('список пайщиков — только принятые, имя для показа без личных данных', async () => {
    const { service } = makeService({ accounts: ACCOUNTS });
    expect(await service.participants()).toEqual([
      { username: 'ivan', name: 'Иванов Иван Иванович' },
      { username: 'bare', name: 'bare' },
    ]);
  });

  it('субъекты по учётным именам: имя и вид, неизвестное имя пропускается, повторы сливаются', async () => {
    const { service, accounts } = makeService({ accounts: ACCOUNTS });
    expect(await service.subjects(['ivan', 'krg', 'ghost', 'ivan', ''])).toEqual([
      { username: 'ivan', name: 'Иванов Иван Иванович', account_kind: 'participant' },
      { username: 'krg', name: 'КУ Красногорск', account_kind: 'branch' },
    ]);
    expect(accounts.getAccount).toHaveBeenCalledTimes(3);
  });

  it('за один запрос стол спрашивает не больше двухсот субъектов', async () => {
    const { service, accounts } = makeService();
    await service.subjects(Array.from({ length: 500 }, (_v, index) => `user${index}`));
    expect(accounts.getAccount).toHaveBeenCalledTimes(200);
  });

  it('кошельки пайщиков: пайщик, программа, остаток; строки без пайщика отброшены', async () => {
    const { service, programWallets } = makeService({
      wallets: [
        { username: 'ivan', program_id: '1', available: '10.0000 RUB', blocked: '1.0000 RUB' },
        { program_id: '2', available: '5.0000 RUB' },
      ],
    });
    expect(await service.participantWallets('voskhod')).toEqual([{ username: 'ivan', program_id: '1', available: '10.0000 RUB' }]);
    expect(programWallets.getProgramWallets).toHaveBeenCalledWith({ coopname: 'voskhod' });
  });
});
