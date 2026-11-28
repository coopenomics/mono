import { accountShortageKind, chainExhaustionReason, isChainExhaustionError, retryOnChainExhaustion } from './chain-retry';

/** Ошибка узла, как её отдаёт APIError @wharfkit/antelope: код на месте. */
function apiError(code: number, name: string, what: string, detail: string) {
  return {
    message: `${what} at /v1/chain/send_transaction`,
    response: { json: { error: { code, name, what, details: [{ message: detail }] } } },
    error: { code, name, what, details: [{ message: detail }] },
  };
}

describe('chainExhaustionReason — опознание «транзакция не влезла в лимит»', () => {
  it.each([
    [3080002, 'tx_net_usage_exceeded'],
    [3080003, 'block_net_usage_exceeded'],
    [3080004, 'tx_cpu_usage_exceeded'],
    [3080005, 'block_cpu_usage_exceeded'],
    [3080006, 'deadline_exception'],
    [3080007, 'greylist_net_usage_exceeded'],
    [3080008, 'greylist_cpu_usage_exceeded'],
    [3081001, 'leeway_deadline_exception'],
  ])('код %i (%s) → повторяем', (code, name) => {
    expect(chainExhaustionReason(apiError(code as number, name as string, 'x', 'y'))).toBe(`${name} (${code})`);
  });

  it('RAM-исчерпание (3080001) — не повторяем: ресурса действительно нет', () => {
    const e = apiError(3080001, 'ram_usage_exceeded', 'Account using more than allotted RAM usage',
      "account voskhod has insufficient ram; needs 1024 bytes has 0 bytes");
    expect(chainExhaustionReason(e)).toBeNull();
  });

  it('ассерт контракта — не повторяем, даже если в тексте есть слово deadline', () => {
    const e = apiError(3050003, 'eosio_assert_message_exception', 'eosio_assert_message assertion failure',
      'assertion failure with message: deadline exceeded for this task');
    expect(chainExhaustionReason(e)).toBeNull();
  });

  // @wharfkit/session в своём catch подменяет APIError на new Error(details[0].message):
  // до нас доходит только строка первой детали — разбираем её текстом.
  describe('текст без кода (после подмены ошибки в @wharfkit/session)', () => {
    it.each([
      'billed CPU time (298012 us) is greater than the maximum billable CPU time for the transaction (290000 us)',
      'billed CPU time (14003 us) is greater than the billable CPU time left in the block (9000 us)',
      'transaction 3f2b… was executing for too long 302145us with a subjective cpu of (1200 us)',
      'not enough time left in block to complete executing transaction 4102us',
      'not enough space left in block: 2048 > 1600',
      'deadline exceeded 10000us',
      'the transaction was unable to complete by deadline, but it is possible it could have succeeded if it were allowed to run to completion 5000us',
      "authorizing account 'voskhod' has insufficient objective cpu resources for this transaction, used in window 402000us, allowed in window 390000us",
      "authorizing account 'voskhod' has insufficient net resources for this transaction, used in window 4000, allowed in window 3800",
      'Block has insufficient cpu resources',
      'transaction net usage is too high: 9000 > 8000',
      'greylisted transaction net usage is too high: 9000 > 8000',
    ])('«%s» → повторяем', (message) => {
      expect(isChainExhaustionError(new Error(message))).toBe(true);
    });

    it.each([
      'assertion failure with message: Кооператив не найден',
      'transaction declares authority ... but does not have signatures for it',
      'account voskhod has insufficient ram; needs 1024 bytes has 0 bytes',
      'expired transaction 3f2b…',
    ])('«%s» → не повторяем', (message) => {
      expect(isChainExhaustionError(new Error(message))).toBe(false);
    });
  });
});

describe('retryOnChainExhaustion — переотправка до исчерпания попыток', () => {
  const sleep = jest.fn().mockResolvedValue(undefined);
  const options = { attempts: 3, delayMs: 500, sleep };

  beforeEach(() => sleep.mockClear());

  it('успех с первой отправки — повторов и пауз нет', async () => {
    const send = jest.fn().mockResolvedValue('ok');
    await expect(retryOnChainExhaustion(send, options)).resolves.toBe('ok');
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('со второго раза проходит — вызывающий ошибки не видит', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('transaction 3f2b… was executing for too long 302145us'))
      .mockResolvedValue('ok');
    await expect(retryOnChainExhaustion(send, options)).resolves.toBe('ok');
    expect(send).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('паузы удваиваются: 500/1000/2000мс', async () => {
    const err = new Error('not enough time left in block to complete executing transaction 4102us');
    const send = jest.fn().mockRejectedValue(err);
    await expect(retryOnChainExhaustion(send, options)).rejects.toBe(err);
    expect(send).toHaveBeenCalledTimes(4); // первая отправка + три повтора
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000, 2000]);
  });

  it('ошибка другого рода уходит сразу, без повторов', async () => {
    const err = new Error('assertion failure with message: Кооператив не найден');
    const send = jest.fn().mockRejectedValue(err);
    await expect(retryOnChainExhaustion(send, options)).rejects.toBe(err);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('attempts=0 — повторы выключены', async () => {
    const err = new Error('billed CPU time (298012 us) is greater than the maximum billable CPU time for the transaction (290000 us)');
    const send = jest.fn().mockRejectedValue(err);
    await expect(retryOnChainExhaustion(send, { ...options, attempts: 0 })).rejects.toBe(err);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('сообщает о каждом повторе — в логе видно, что пик был', async () => {
    const onRetry = jest.fn();
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('deadline exceeded 10000us'))
      .mockResolvedValue('ok');
    await retryOnChainExhaustion(send, { ...options, onRetry });
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, attempts: 3, delayMs: 500, reason: expect.stringContaining('deadline exceeded') })
    );
  });
});

// 28.11.2026: нехватку ресурсов самого аккаунта лечит аренда — ядро просит её
// до повтора, и транзакция повторяется сразу. Раньше кооператив ждал плановой
// проверки ресурсов раз в минуту, а пайщик получал отказ.
describe('accountShortageKind — нехватка ресурсов самого аккаунта', () => {
  it.each([
    ["authorizing account 'partner1' has insufficient objective cpu resources for this transaction", 'cpu'],
    [
      'billed CPU time (812 us) is greater than the maximum billable CPU time for the transaction (500 us) reached account cpu limit 500us',
      'cpu',
    ],
    ["authorizing account 'partner1' has insufficient net resources for this transaction", 'net'],
    ['account partner1 has insufficient ram; needs 1200 bytes has 800 bytes', 'ram'],
  ])('«%s» → %s', (text, kind) => {
    expect(accountShortageKind(new Error(text))).toBe(kind);
  });

  it('код 3080001 (ram_usage_exceeded) — память аккаунта', () => {
    expect(accountShortageKind(apiError(3080001, 'ram_usage_exceeded', 'x', 'y'))).toBe('ram');
  });

  it('break: пик нагрузки и ассерт контракта арендой не лечатся', () => {
    expect(
      accountShortageKind(new Error('billed CPU time (812 us) is greater than the billable CPU time left in the block (300 us)'))
    ).toBeNull();
    expect(accountShortageKind(apiError(3080004, 'tx_cpu_usage_exceeded', 'x', 'transaction was executing for too long'))).toBeNull();
    expect(accountShortageKind(new Error('assertion failure with message: REGISTRATOR_NOT_OPERATOR: ...'))).toBeNull();
  });
});

describe('retryOnChainExhaustion — аренда ресурсов перед повтором', () => {
  const cpuShortage = () => new Error("authorizing account 'partner1' has insufficient objective cpu resources for this transaction");
  const ramShortage = () =>
    apiError(3080001, 'ram_usage_exceeded', 'x', 'account partner1 has insufficient ram; needs 1200 bytes has 800 bytes');

  it('happy: не хватило ресурсов аккаунта — аренда и повтор сразу, без паузы', async () => {
    const send = jest.fn().mockRejectedValueOnce(cpuShortage()).mockResolvedValue('ok');
    const replenish = jest.fn(async () => true);
    const sleep = jest.fn(async () => undefined);

    expect(await retryOnChainExhaustion(send, { attempts: 3, delayMs: 500, replenish, sleep })).toBe('ok');
    expect(replenish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'cpu' }));
    expect(send).toHaveBeenCalledTimes(2);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('happy: не хватило памяти — после аренды транзакция проходит, хотя память в обычный повтор не входит', async () => {
    const send = jest.fn().mockRejectedValueOnce(ramShortage()).mockResolvedValue('ok');
    const replenish = jest.fn(async () => true);

    expect(await retryOnChainExhaustion(send, { attempts: 0, delayMs: 500, replenish })).toBe('ok');
    expect(replenish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ram' }));
  });

  it('side: повтор после аренды попытку не расходует', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(cpuShortage())
      .mockRejectedValueOnce(apiError(3080005, 'block_cpu_usage_exceeded', 'x', 'y'))
      .mockResolvedValue('ok');
    const sleep = jest.fn(async () => undefined);

    expect(await retryOnChainExhaustion(send, { attempts: 1, delayMs: 500, replenish: async () => true, sleep })).toBe('ok');
    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('break: аренда идёт один раз на отправку — вторая нехватка подряд идёт обычным путём', async () => {
    const send = jest.fn().mockRejectedValue(ramShortage());
    const replenish = jest.fn(async () => true);

    await expect(
      retryOnChainExhaustion(send, { attempts: 3, delayMs: 500, replenish, sleep: async () => undefined })
    ).rejects.toBeDefined();
    expect(replenish).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('break: арендовать не удалось — отказ по памяти получает вызывающий, время и полоса повторяются с паузой', async () => {
    const ram = jest.fn().mockRejectedValue(ramShortage());
    await expect(retryOnChainExhaustion(ram, { attempts: 3, delayMs: 500, replenish: async () => false })).rejects.toBeDefined();
    expect(ram).toHaveBeenCalledTimes(1);

    const cpu = jest.fn().mockRejectedValueOnce(cpuShortage()).mockResolvedValue('ok');
    const sleep = jest.fn(async () => undefined);
    expect(await retryOnChainExhaustion(cpu, { attempts: 3, delayMs: 500, replenish: async () => false, sleep })).toBe('ok');
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('break: отказ другого рода аренду не вызывает', async () => {
    const replenish = jest.fn(async () => true);
    const send = jest.fn().mockRejectedValue(new Error('assertion failure with message: недостаточно средств'));

    await expect(retryOnChainExhaustion(send, { attempts: 3, delayMs: 500, replenish })).rejects.toBeDefined();
    expect(replenish).not.toHaveBeenCalled();
  });
});
