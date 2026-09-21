/** Возврат остатка кошелька программы в паевой взнос: заявление пайщика и согласование кооперативом. */
import { EdubridgeReturnService } from '~/extensions/edubridge/application/services/edubridge-return.service';
import { EduReturnStatus } from '~/extensions/edubridge/domain/enums';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB' } }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

function make(opts: { available?: string; rows?: any[] } = {}) {
  const rows: any[] = opts.rows ?? [];
  const requests = {
    create: jest.fn((d: any) => ({ id: `R${rows.length + 1}`, decline_reason: '', decided_at: null, ...d })),
    save: jest.fn(async (r: any) => { if (!rows.includes(r)) rows.push(r); return r; }),
    findById: jest.fn(async (_c: string, id: string) => rows.find((r) => r.id === id) ?? null),
    findByMember: jest.fn(async (_c: string, m: string) => rows.filter((r) => r.member_username === m)),
    findByStatus: jest.fn(async (_c: string, s?: EduReturnStatus) => rows.filter((r) => !s || r.status === s)),
  } as any;
  const chain = { returnToShare: jest.fn(async () => ({ transaction_id: 'TRX' })) } as any;
  const documents = { generate: jest.fn(async (r: any) => ({ hash: 'DOC', meta: r.data })) } as any;
  const wallets = { findByWalletAndUsername: jest.fn(async () => ({ available: opts.available ?? '1000.0000 RUB' })) } as any;
  const service = new EdubridgeReturnService(requests, chain, documents, wallets, logger);
  return { service, requests, chain, documents, wallets, rows };
}

const signed = (amount: string, signer = 'ant', hash = 'AABB') => ({ hash, meta: { amount }, signatures: [{ signer }] }) as any;

describe('EdubridgeReturnService', () => {
  it('заявление 3013 формируется на сумму в пределах остатка кошелька программы', async () => {
    const { service, documents, wallets } = make();
    await service.statement('voskhod', 'ant', '400.0000 RUB');
    expect(wallets.findByWalletAndUsername).toHaveBeenCalledWith('voskhod', 'w.edu.member', 'ant');
    expect(documents.generate).toHaveBeenCalledWith({ data: expect.objectContaining({ registry_id: 3013, username: 'ant', amount: '400.0000 RUB' }) });
  });

  it('сумма больше остатка, нулевая и не в формате цепи отклоняется', async () => {
    const { service, documents } = make();
    await expect(service.statement('voskhod', 'ant', '1000.0001 RUB')).rejects.toThrow(/К возврату доступно 1000.0000 RUB/);
    await expect(service.statement('voskhod', 'ant', '0.0000 RUB')).rejects.toThrow(/больше нуля/);
    await expect(service.statement('voskhod', 'ant', '100 RUB')).rejects.toThrow(/в формате/);
    expect(documents.generate).not.toHaveBeenCalled();
  });

  it('подписанное заявление становится заявкой на согласование — в цепь до решения кооператива ничего не уходит', async () => {
    const { service, chain } = make();
    const r = await service.request('voskhod', 'ant', '400.0000 RUB', signed('400.0000 RUB'));
    expect(r.status).toBe(EduReturnStatus.PENDING);
    expect(r.statement_hash).toBe('aabb');
    expect(chain.returnToShare).not.toHaveBeenCalled();
  });

  it('уже заявленное к возврату второй раз заявить нельзя', async () => {
    const { service } = make();
    await service.request('voskhod', 'ant', '700.0000 RUB', signed('700.0000 RUB'));
    const balance = await service.balance('voskhod', 'ant');
    expect(balance).toEqual({ available: '1000.0000 RUB', pending: '700.0000 RUB', free: '300.0000 RUB' });
    await expect(service.request('voskhod', 'ant', '400.0000 RUB', signed('400.0000 RUB', 'ant', 'CCDD'))).rejects.toThrow(/доступно 300.0000 RUB/);
  });

  it('заявление без подписи пайщика и с другой суммой не принимается', async () => {
    const { service, requests } = make();
    await expect(service.request('voskhod', 'ant', '400.0000 RUB', signed('400.0000 RUB', 'other'))).rejects.toThrow(/не подписано пайщиком/);
    await expect(service.request('voskhod', 'ant', '400.0000 RUB', signed('900.0000 RUB'))).rejects.toThrow(/расходится с суммой/);
    // Мета может прийти строкой JSON — сверка та же.
    const asString = { hash: 'EE', meta: JSON.stringify({ amount: '400.0000 RUB' }), signatures: [{ signer: 'ant' }] } as any;
    await expect(service.request('voskhod', 'ant', '400.0000 RUB', asString)).resolves.toMatchObject({ status: EduReturnStatus.PENDING });
    expect(requests.save).toHaveBeenCalledTimes(1);
  });

  it('согласование: retshare с подписанным заявлением, заявка закрыта, решение записано', async () => {
    const { service, chain } = make();
    const document = signed('400.0000 RUB');
    const r = await service.request('voskhod', 'ant', '400.0000 RUB', document);
    const approved = await service.approve('voskhod', r.id, 'chair');
    expect(chain.returnToShare).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'ant', amount: '400.0000 RUB', statement: document });
    expect(approved).toMatchObject({ status: EduReturnStatus.APPROVED, decided_by: 'chair' });
    expect(approved.decided_at).toBeInstanceOf(Date);
  });

  it('пайщик успел потратить остаток на подписку — согласование отклоняется до обращения к цепи', async () => {
    const { service, chain, wallets } = make();
    const r = await service.request('voskhod', 'ant', '400.0000 RUB', signed('400.0000 RUB'));
    wallets.findByWalletAndUsername.mockResolvedValue({ available: '100.0000 RUB' });
    await expect(service.approve('voskhod', r.id, 'chair')).rejects.toThrow(/меньше заявленного/);
    expect(chain.returnToShare).not.toHaveBeenCalled();
    expect(r.status).toBe(EduReturnStatus.PENDING);
  });

  it('сбой цепи при согласовании оставляет заявку ожидающей', async () => {
    const { service, chain } = make();
    const r = await service.request('voskhod', 'ant', '400.0000 RUB', signed('400.0000 RUB'));
    chain.returnToShare.mockRejectedValueOnce(new Error('цепь не отвечает'));
    await expect(service.approve('voskhod', r.id, 'chair')).rejects.toThrow(/не отвечает/);
    expect(r.status).toBe(EduReturnStatus.PENDING);
  });

  it('отказ: причина обязательна, остаток снова доступен для заявления', async () => {
    const { service, chain } = make();
    const r = await service.request('voskhod', 'ant', '700.0000 RUB', signed('700.0000 RUB'));
    await expect(service.decline('voskhod', r.id, 'chair', ' ')).rejects.toThrow(/причину/);
    const declined = await service.decline('voskhod', r.id, 'chair', 'Остаток зачтён в следующую подписку по просьбе пайщика');
    expect(declined).toMatchObject({ status: EduReturnStatus.DECLINED, decided_by: 'chair' });
    expect(chain.returnToShare).not.toHaveBeenCalled();
    expect((await service.balance('voskhod', 'ant')).free).toBe('1000.0000 RUB');
  });

  it('повторное решение по закрытой заявке и решение по чужому кооперативу отклоняются', async () => {
    const { service } = make();
    const r = await service.request('voskhod', 'ant', '400.0000 RUB', signed('400.0000 RUB'));
    await service.approve('voskhod', r.id, 'chair');
    await expect(service.approve('voskhod', r.id, 'chair')).rejects.toThrow(/уже принято решение/);
    await expect(service.decline('voskhod', r.id, 'chair', 'причина')).rejects.toThrow(/уже принято решение/);
    await expect(service.approve('voskhod', 'NOPE', 'chair')).rejects.toThrow(/не найдена/);
  });
});
