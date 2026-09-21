/**
 * Прекращение участия в ЦПП «Образование»: членский взнос программы уходит в
 * паевой только с прекращением участия — по заявлению пайщика и согласованию
 * кооператива, подписки закрываются с возвратом по Положению, остаток переводится целиком.
 */
import { EdubridgeReturnService } from '~/extensions/edubridge/application/services/edubridge-return.service';
import { EduReturnStatus } from '~/extensions/edubridge/domain/enums';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB' } }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

/** Пайщик: 1000 на кошельке программы и одна действующая подписка, по которой сегодня вернут 250. */
function make(opts: { available?: string; subscriptions?: number; refunds?: number; rows?: any[] } = {}) {
  const rows: any[] = opts.rows ?? [];
  const requests = {
    create: jest.fn((d: any) => ({ id: `R${rows.length + 1}`, decline_reason: '', decided_at: null, ...d })),
    save: jest.fn(async (r: any) => { if (!rows.includes(r)) rows.push(r); return r; }),
    findById: jest.fn(async (_c: string, id: string) => rows.find((r) => r.id === id) ?? null),
    findByMember: jest.fn(async (_c: string, m: string) => rows.filter((r) => r.member_username === m)),
    findByStatus: jest.fn(async (_c: string, s?: EduReturnStatus) => rows.filter((r) => !s || r.status === s)),
  } as any;
  let open = opts.subscriptions ?? 1;
  const refunds = opts.refunds ?? 250;
  const enrollments = {
    refundsOnExit: jest.fn(async () => ({ subscriptions: open, refunds: open ? refunds : 0 })),
    cancelAllForMember: jest.fn(async () => {
      const closed = Array.from({ length: open }, () => ({ refunded_amount: `${(refunds / Math.max(1, open)).toFixed(4)} RUB` }));
      open = 0;
      return closed;
    }),
  } as any;
  const chain = { returnToShare: jest.fn(async () => ({ transaction_id: 'TRX' })) } as any;
  const documents = { generate: jest.fn(async (r: any) => ({ hash: 'DOC', meta: r.data })) } as any;
  const wallets = { findByWalletAndUsername: jest.fn(async () => ({ available: opts.available ?? '1000.0000 RUB' })) } as any;
  const service = new EdubridgeReturnService(requests, enrollments, chain, documents, wallets, logger);
  return { service, requests, enrollments, chain, documents, wallets, rows };
}

const signed = (signer = 'ant', hash = 'AABB', registry_id: unknown = 3013) => ({ hash, meta: { registry_id }, signatures: [{ signer }] }) as any;

describe('EdubridgeReturnService — прекращение участия в программе', () => {
  it('баланс показывает, что уйдёт в паевой сегодня: остаток плюс возврат по подпискам', async () => {
    const { service, wallets } = make();
    expect(await service.balance('voskhod', 'ant')).toEqual({
      available: '1000.0000 RUB',
      refunds: '250.0000 RUB',
      total: '1250.0000 RUB',
      subscriptions: 1,
      has_pending: false,
    });
    expect(wallets.findByWalletAndUsername).toHaveBeenCalledWith('voskhod', 'w.edu.member', 'ant');
  });

  it('заявление 3013 формируется без суммы', async () => {
    const { service, documents } = make();
    await service.statement('voskhod', 'ant');
    const data = documents.generate.mock.calls[0][0].data;
    expect(data).toMatchObject({ registry_id: 3013, username: 'ant' });
    expect(data).not.toHaveProperty('amount');
  });

  it('подписанное заявление ждёт согласования — в цепь до решения ничего не уходит', async () => {
    const { service, chain, enrollments } = make();
    const r = await service.request('voskhod', 'ant', signed());
    expect(r).toMatchObject({ status: EduReturnStatus.PENDING, statement_hash: 'aabb', amount: '1250.0000 RUB' });
    expect(chain.returnToShare).not.toHaveBeenCalled();
    expect(enrollments.cancelAllForMember).not.toHaveBeenCalled();
  });

  it('второе заявление, пока первое ждёт решения, не подаётся', async () => {
    const { service, documents } = make();
    await service.request('voskhod', 'ant', signed());
    expect((await service.balance('voskhod', 'ant')).has_pending).toBe(true);
    await expect(service.request('voskhod', 'ant', signed('ant', 'CCDD'))).rejects.toThrow(/уже подано/);
    await expect(service.statement('voskhod', 'ant')).rejects.toThrow(/уже подано/);
    expect(documents.generate).not.toHaveBeenCalled();
  });

  it('заявление без подписи пайщика и чужой документ не принимаются', async () => {
    const { service, requests } = make();
    await expect(service.request('voskhod', 'ant', signed('other'))).rejects.toThrow(/не подписано пайщиком/);
    await expect(service.request('voskhod', 'ant', signed('ant', 'AA', 3011))).rejects.toThrow(/не тот документ/);
    // Мета может прийти строкой JSON.
    const asString = { hash: 'EE', meta: JSON.stringify({ registry_id: 3013 }), signatures: [{ signer: 'ant' }] } as any;
    await expect(service.request('voskhod', 'ant', asString)).resolves.toMatchObject({ status: EduReturnStatus.PENDING });
    expect(requests.save).toHaveBeenCalledTimes(1);
  });

  it('согласование: подписки закрываются, в паевой уходит весь остаток вместе с возвратами', async () => {
    const { service, chain, enrollments } = make();
    const document = signed();
    const r = await service.request('voskhod', 'ant', document);
    const approved = await service.approve('voskhod', r.id, 'chair');
    expect(enrollments.cancelAllForMember).toHaveBeenCalledWith('voskhod', 'ant', expect.any(String));
    expect(chain.returnToShare).toHaveBeenCalledWith({ coopname: 'voskhod', username: 'ant', amount: '1250.0000 RUB', statement: document });
    expect(approved).toMatchObject({ status: EduReturnStatus.APPROVED, decided_by: 'chair', amount: '1250.0000 RUB' });
    expect(approved.decided_at).toBeInstanceOf(Date);
  });

  it('пустой кошелёк без подписок: участие прекращается с нулевым переводом', async () => {
    const { service, chain } = make({ available: '0.0000 RUB', subscriptions: 0 });
    const r = await service.request('voskhod', 'ant', signed());
    await service.approve('voskhod', r.id, 'chair');
    expect(chain.returnToShare).toHaveBeenCalledWith(expect.objectContaining({ amount: '0.0000 RUB' }));
  });

  it('подписка не закрылась — в цепь перевод не уходит, заявление ждёт повтора', async () => {
    const { service, chain, enrollments } = make();
    enrollments.cancelAllForMember.mockResolvedValueOnce([]);
    const r = await service.request('voskhod', 'ant', signed());
    await expect(service.approve('voskhod', r.id, 'chair')).rejects.toThrow(/Не удалось закрыть подписок: 1/);
    expect(chain.returnToShare).not.toHaveBeenCalled();
    expect(r.status).toBe(EduReturnStatus.PENDING);
  });

  it('сбой цепи при согласовании оставляет заявление ожидающим', async () => {
    const { service, chain } = make();
    const r = await service.request('voskhod', 'ant', signed());
    chain.returnToShare.mockRejectedValueOnce(new Error('цепь не отвечает'));
    await expect(service.approve('voskhod', r.id, 'chair')).rejects.toThrow(/не отвечает/);
    expect(r.status).toBe(EduReturnStatus.PENDING);
  });

  it('отказ: причина обязательна, участие продолжается', async () => {
    const { service, chain, enrollments } = make();
    const r = await service.request('voskhod', 'ant', signed());
    await expect(service.decline('voskhod', r.id, 'chair', ' ')).rejects.toThrow(/причину/);
    const declined = await service.decline('voskhod', r.id, 'chair', 'Пайщик передумал и продолжает обучение');
    expect(declined).toMatchObject({ status: EduReturnStatus.DECLINED, decided_by: 'chair' });
    expect(chain.returnToShare).not.toHaveBeenCalled();
    expect(enrollments.cancelAllForMember).not.toHaveBeenCalled();
    expect((await service.balance('voskhod', 'ant')).has_pending).toBe(false);
  });

  it('повторное решение и решение по несуществующему заявлению отклоняются', async () => {
    const { service } = make();
    const r = await service.request('voskhod', 'ant', signed());
    await service.approve('voskhod', r.id, 'chair');
    await expect(service.approve('voskhod', r.id, 'chair')).rejects.toThrow(/уже принято решение/);
    await expect(service.decline('voskhod', r.id, 'chair', 'причина')).rejects.toThrow(/уже принято решение/);
    await expect(service.approve('voskhod', 'NOPE', 'chair')).rejects.toThrow(/не найдено/);
  });
});
