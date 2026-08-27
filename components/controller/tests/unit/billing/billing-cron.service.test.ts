/**
 * Хаб-крон биллинга (Epic 12/13, BILLING_HUB_MODE): за каждый активный
 * кооператив-спицу оператор списывает оплату подписок (billing::pay) и при
 * исчерпании AXON докупает пакет документооборота (billing::converttoaxn).
 *
 * Деньги списываются on-chain — поэтому здесь зафиксированы барьеры:
 *   - без срока оплаты / с нулевой суммой транзакций нет;
 *   - PAID-invoice провайдера не списывается второй раз;
 *   - журнал платежей PG — единственный источник идемпотентности: существующая
 *     запись блокирует повтор (SUBMITTED → только донести подтверждение);
 *   - доменный отказ ноды → FAILED (повтор безопасен), сетевая ошибка →
 *     запись остаётся SUBMITTING (tx могла пройти — автоповтора нет);
 *   - пакет докупается только при PENDING от провайдера и AXON ниже порога.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    coopname: 'voskhod',
    blockchain: { root_govern_precision: 4, root_govern_symbol: 'RUB' },
    billing: { hub_mode: true, cron_expression: '0 * * * *', package_low_water_axon: 15 },
  },
}));
jest.mock('~/application/provider/services/provider.service', () => ({ ProviderService: class {} }));

import { BillingCronService } from '~/domain/billing/services/billing-cron.service';
import { BillingPaymentLogStatus } from '~/infrastructure/billing/entities/billing-payment-log.entity';

const HASH = 'a'.repeat(64);

const summary = (over: Partial<any> = {}) => ({
  coopname: 'partner1',
  period_days: 30,
  total_amount: 1500,
  currency: 'RUB',
  items: [{ subscription_id: 1, subscription_type_id: 1, subscription_type_name: 'Хостинг', status: 'ACTIVE', amount: 1500, is_free: false }],
  payment_hash: HASH,
  next_payment_due: null,
  ...over,
});

const build = (opts: {
  summary?: any;
  invoice?: any;
  packageInvoice?: any;
  axon?: number;
  begin?: any;
  payError?: Error;
} = {}) => {
  const blockchainPort = {
    pay: jest.fn(async () => {
      if (opts.payError) throw opts.payError;
      return { transaction_id: 'tx-pay' };
    }),
    convertToAxn: jest.fn(async () => ({ transaction_id: 'tx-axn' })),
    getAxonBalance: jest.fn(async () => opts.axon ?? 100),
  };
  const providerClient = {
    isConfigured: jest.fn(() => true),
    getBillingSummary: jest.fn(async () => opts.summary ?? summary()),
    createInvoice: jest.fn(async () => opts.invoice ?? { payment_hash: HASH, coopname: 'partner1', total_amount: 1500, status: 'PENDING', expires_at: '' }),
    confirmPayment: jest.fn(async () => undefined),
    createPackageInvoice: jest.fn(async () => opts.packageInvoice ?? { status: 'NO_PACKAGE' }),
    confirmTopupAxon: jest.fn(async () => undefined),
  };
  const providerService = {
    getCooperativesRegistry: jest.fn(async () => [
      { coopname: 'partner1', status: 'active' },
      { coopname: 'pending1', status: 'pending' },
    ]),
  };
  const paymentLog = {
    begin: jest.fn(async () => opts.begin ?? { started: true }),
    markSubmitted: jest.fn(async () => undefined),
    markConfirmed: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    recordError: jest.fn(async () => undefined),
  };
  const svc = new BillingCronService(blockchainPort as any, providerClient as any, providerService as any, paymentLog as any);
  return { svc, blockchainPort, providerClient, providerService, paymentLog };
};

describe('BillingCronService — тик хаба', () => {
  it('happy: активный кооп, срок подошёл → invoice → журнал → billing::pay оператором за пайщика → confirmPayment → CONFIRMED; pending-кооп не трогается', async () => {
    const h = build();
    await h.svc.tick();

    expect(h.providerClient.getBillingSummary).toHaveBeenCalledTimes(1);
    expect(h.providerClient.getBillingSummary).toHaveBeenCalledWith('partner1');
    expect(h.providerClient.createInvoice).toHaveBeenCalledWith('partner1', [{ subscription_id: 1, period_days: 30 }]);
    // Четвёртым аргументом — за что списано: журнал единственная летопись
    // платежей, и без состава в истории у пайщика видна одна сумма.
    expect(h.paymentLog.begin).toHaveBeenCalledWith(HASH, 'partner1', '1500.0000 RUB', 'Хостинг');
    expect(h.blockchainPort.pay).toHaveBeenCalledWith(expect.objectContaining({ coopname: 'voskhod', username: 'partner1', quantity: '1500.0000 RUB', paymentHash: HASH }));
    expect(h.paymentLog.markSubmitted).toHaveBeenCalledWith(HASH, 'tx-pay');
    expect(h.providerClient.confirmPayment).toHaveBeenCalledWith({ paymentHash: HASH, blockchainTransactionId: 'tx-pay' });
    expect(h.paymentLog.markConfirmed).toHaveBeenCalledWith(HASH);
  });

  it('side: срок оплаты в будущем / сумма 0 / все позиции free → invoice не выписывается, транзакций нет', async () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    for (const s of [summary({ next_payment_due: future }), summary({ total_amount: 0 }), summary({ items: [{ ...summary().items[0], is_free: true }] })]) {
      const h = build({ summary: s });
      await h.svc.tick();
      expect(h.providerClient.createInvoice).not.toHaveBeenCalled();
      expect(h.blockchainPort.pay).not.toHaveBeenCalled();
    }
  });

  it('break: провайдер вернул invoice со статусом PAID → списания нет (оплата уже зафиксирована)', async () => {
    const h = build({ invoice: { payment_hash: HASH, coopname: 'partner1', total_amount: 1500, status: 'PAID', expires_at: '' } });
    await h.svc.tick();
    expect(h.paymentLog.begin).not.toHaveBeenCalled();
    expect(h.blockchainPort.pay).not.toHaveBeenCalled();
  });

  it('break: запись по payment_hash уже SUBMITTED в журнале → второго billing::pay нет, подтверждение доносится провайдеру', async () => {
    const h = build({ begin: { started: false, existing: { status: BillingPaymentLogStatus.SUBMITTED, tx_id: 'tx-old' } } });
    await h.svc.tick();
    expect(h.blockchainPort.pay).not.toHaveBeenCalled();
    expect(h.providerClient.confirmPayment).toHaveBeenCalledWith({ paymentHash: HASH, blockchainTransactionId: 'tx-old' });
    expect(h.paymentLog.markConfirmed).toHaveBeenCalledWith(HASH);
  });

  it('break: запись SUBMITTING (платёж в полёте или crash-окно) → ни повтора, ни подтверждения — нужна сверка с чейном', async () => {
    const h = build({ begin: { started: false, existing: { status: BillingPaymentLogStatus.SUBMITTING, tx_id: null } } });
    await h.svc.tick();
    expect(h.blockchainPort.pay).not.toHaveBeenCalled();
    expect(h.providerClient.confirmPayment).not.toHaveBeenCalled();
  });

  it('break: нода отклонила pay доменно (assertion failure — нет средств на w.wal.bill) → FAILED, подтверждения нет, тик не падает', async () => {
    const h = build({ payError: new Error('assertion failure with message: недостаточно средств') });
    await expect(h.svc.tick()).resolves.toBeUndefined();
    expect(h.paymentLog.markFailed).toHaveBeenCalledWith(HASH, expect.stringContaining('assertion failure'));
    expect(h.paymentLog.markSubmitted).not.toHaveBeenCalled();
    expect(h.providerClient.confirmPayment).not.toHaveBeenCalled();
  });

  it('break: сетевая ошибка при pay → recordError, статус остаётся SUBMITTING (tx могла пройти), markFailed НЕ вызывается', async () => {
    const h = build({ payError: new Error('ECONNRESET') });
    await h.svc.tick();
    expect(h.paymentLog.recordError).toHaveBeenCalledWith(HASH, 'ECONNRESET');
    expect(h.paymentLog.markFailed).not.toHaveBeenCalled();
  });

  it('side: второй tick поверх незавершённого → пропуск (running-guard)', async () => {
    let release!: () => void;
    const h = build();
    h.providerService.getCooperativesRegistry.mockImplementationOnce(() => new Promise((r) => { release = () => r([]); }));
    const first = h.svc.tick();
    await h.svc.tick();
    expect(h.providerService.getCooperativesRegistry).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
});

describe('BillingCronService — идентификатор транзакции', () => {
  it('break: id лежит в ответе ноды (response.transaction_id), а не в корне — иначе провайдер получает подтверждение без ссылки на цепь', async () => {
    const h = build();
    // Форма ответа wharfkit: сам результат несёт response с id.
    h.blockchainPort.pay = jest.fn(async () => ({ response: { transaction_id: 'tx-real' } })) as any;

    await h.svc.tick();

    expect(h.paymentLog.markSubmitted).toHaveBeenCalledWith(HASH, 'tx-real');
    expect(h.providerClient.confirmPayment).toHaveBeenCalledWith({
      paymentHash: HASH,
      blockchainTransactionId: 'tx-real',
    });
  });

  it('side: id в корне результата тоже читается — старую форму ответа не ломаем', async () => {
    const h = build();
    h.blockchainPort.pay = jest.fn(async () => ({ transaction_id: 'tx-flat' })) as any;

    await h.svc.tick();

    expect(h.paymentLog.markSubmitted).toHaveBeenCalledWith(HASH, 'tx-flat');
  });
});

describe('BillingCronService — классификация отказов ноды', () => {
  // Отказ, после которого транзакции в блоке точно нет, обязан помечаться FAILED:
  // только из FAILED журнал разрешает повтор. Всё, что могло пройти, остаётся
  // SUBMITTING без автоповтора — иначе списание уйдёт дважды.
  const deterministic = [
    ['лимит CPU цепи', 'transaction 81cf2406 was executing for too long 304824us reached on chain max_transaction_cpu_usage 290000us'],
    ['лимит NET', 'tx_net_usage_exceeded: transaction net usage is too high'],
    ['протухший срок', 'expired transaction: transaction expired'],
    ['assert контракта', 'assertion failure with message: walletop TRANSFER: недостаточно средств'],
  ] as const;

  it.each(deterministic)('break: %s → FAILED, повтор разрешён — иначе платёж навсегда застревает в «отправляется»', async (_name, message) => {
    const h = build({ payError: new Error(message) });

    await h.svc.tick();

    expect(h.paymentLog.markFailed).toHaveBeenCalledWith(HASH, expect.stringContaining(message.slice(0, 20)));
    expect(h.paymentLog.recordError).not.toHaveBeenCalled();
  });

  it('side: обрыв связи → запись остаётся SUBMITTING без автоповтора — транзакция могла пройти', async () => {
    const h = build({ payError: new Error('connect ECONNREFUSED 172.27.0.10:8888') });

    await h.svc.tick();

    expect(h.paymentLog.recordError).toHaveBeenCalled();
    expect(h.paymentLog.markFailed).not.toHaveBeenCalled();
  });

  it('side: дубль транзакции → НЕ отказ: цепь её уже приняла, повторять нельзя', async () => {
    const h = build({ payError: new Error('duplicate transaction 81cf2406') });

    await h.svc.tick();

    expect(h.paymentLog.markFailed).not.toHaveBeenCalled();
    expect(h.paymentLog.recordError).toHaveBeenCalled();
  });
});

describe('BillingCronService — состав платежа в журнале', () => {
  it('happy: несколько платных услуг → в журнал уходит перечень имён, бесплатные в него не попадают', async () => {
    const h = build({
      summary: summary({
        total_amount: 5160,
        items: [
          { subscription_id: 1, subscription_type_id: 1, subscription_type_name: 'Хостинг на сервере', status: 'ACTIVE', amount: 3660, is_free: false },
          { subscription_id: 2, subscription_type_id: 2, subscription_type_name: 'Поддержка', status: 'ACTIVE', amount: 1500, is_free: false },
          { subscription_id: 3, subscription_type_id: 3, subscription_type_name: 'Освобождённая услуга', status: 'ACTIVE', amount: 0, is_free: true },
        ],
      }),
    });

    await h.svc.tick();

    expect(h.paymentLog.begin).toHaveBeenCalledWith(
      HASH,
      'partner1',
      expect.any(String),
      'Хостинг на сервере, Поддержка',
    );
  });

  it('side: имя услуги в сводке отсутствует → журнал получает пустой состав, списание всё равно идёт', async () => {
    const h = build({
      summary: summary({
        items: [{ subscription_id: 1, subscription_type_id: 1, subscription_type_name: '', status: 'ACTIVE', amount: 1500, is_free: false }],
      }),
    });

    await h.svc.tick();

    expect(h.paymentLog.begin).toHaveBeenCalledWith(HASH, 'partner1', '1500.0000 RUB', '');
    expect(h.blockchainPort.pay).toHaveBeenCalled();
  });
});

describe('BillingCronService — докупка пакета (Epic 13)', () => {
  it('happy: AXON ниже порога, провайдер дал PENDING → журнал → billing::converttoaxn → confirmTopupAxon с суммой', async () => {
    const h = build({ summary: summary({ total_amount: 0 }), axon: 3, packageInvoice: { status: 'PENDING', payment_hash: HASH, coopname: 'partner1', total_amount: 1500, expires_at: '' } });
    await h.svc.tick();
    expect(h.blockchainPort.convertToAxn).toHaveBeenCalledWith({ username: 'partner1', quantity: '1500.0000 RUB', paymentHash: HASH });
    expect(h.providerClient.confirmTopupAxon).toHaveBeenCalledWith({ paymentHash: HASH, blockchainTransactionId: 'tx-axn', coopname: 'partner1', amountRub: 1500 });
    expect(h.paymentLog.markConfirmed).toHaveBeenCalledWith(HASH);
  });

  it('side: AXON выше порога → провайдер не опрашивается, конвертации нет', async () => {
    const h = build({ summary: summary({ total_amount: 0 }), axon: 50 });
    await h.svc.tick();
    expect(h.providerClient.createPackageInvoice).not.toHaveBeenCalled();
    expect(h.blockchainPort.convertToAxn).not.toHaveBeenCalled();
  });

  it('break: провайдер ответил BLOCKED (квота/cooldown) или NO_PACKAGE → конвертации нет; уведомление кооперативу — зона провайдера', async () => {
    for (const inv of [{ status: 'BLOCKED', reason: 'quota_exceeded' }, { status: 'NO_PACKAGE' }]) {
      const h = build({ summary: summary({ total_amount: 0 }), axon: 3, packageInvoice: inv });
      await h.svc.tick();
      expect(h.blockchainPort.convertToAxn).not.toHaveBeenCalled();
      expect(h.paymentLog.begin).not.toHaveBeenCalled();
    }
  });
});
