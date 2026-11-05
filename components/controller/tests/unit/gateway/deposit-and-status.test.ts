/**
 * Взнос и смена статуса платежа — отказы со своей причиной.
 *
 * До 25.09.2026 взнос на 0 и −100 RUB принимался (в реестре кассира
 * появлялся платёж на отрицательную сумму), а любой сбой смены статуса —
 * в том числе попытка отменить уже проведённый платёж — выдавался за
 * «платёж не найден». Нашёл внешний слой.
 */
import { GatewayInteractor } from '~/application/gateway/interactors/gateway.interactor';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';

function makeInteractor(payment: any = null) {
  const paymentRepository = {
    expireOutdatedPayments: jest.fn(async () => undefined),
    findActivePendingPayment: jest.fn(async () => null),
    findById: jest.fn(async () => payment),
    setPaymentStatus: jest.fn(async () => null),
    update: jest.fn(async () => null),
  } as any;
  const stub = {} as any;
  const interactor = new GatewayInteractor(stub, paymentRepository, stub, stub, stub, stub, stub, stub, stub);
  return { interactor, paymentRepository };
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e: any) {
    return e.code ?? null;
  }
}

describe('взнос — только положительная сумма', () => {
  it.each([0, -100, Number.NaN])('сумма %p — отказ до создания платежа', async (quantity) => {
    const { interactor, paymentRepository } = makeInteractor();
    const code = await codeOf(interactor.createDeposit({ username: 'ivanov', quantity, symbol: 'RUB' } as any));
    expect(code).toBe('GATEWAY_DEPOSIT_AMOUNT_NOT_POSITIVE');
    expect(paymentRepository.findActivePendingPayment).not.toHaveBeenCalled();
  });
});

describe('смена статуса — настоящая причина отказа', () => {
  it('проведённый платёж не отменяется, и ответ говорит именно это', async () => {
    const { interactor, paymentRepository } = makeInteractor({ id: 'p1', status: PaymentStatusEnum.COMPLETED });
    const code = await codeOf(interactor.setPaymentStatus({ id: 'p1', status: PaymentStatusEnum.CANCELLED } as any));
    expect(code).toBe('GATEWAY_PAYMENT_STATUS_CHANGE_FORBIDDEN');
    expect(paymentRepository.setPaymentStatus).not.toHaveBeenCalled();
  });

  // Платёж «ожидает решения совета» (заведён до заявок на выплату) кассир не
  // трогает: дальше его переводит только решение совета (решение владельца 04.11.2026).
  it('платёж «ожидает решения совета» кассир не переводит — отказ до решения совета', async () => {
    const { interactor, paymentRepository } = makeInteractor({ id: 'p2', status: PaymentStatusEnum.AWAITING_AUTHORIZATION });
    const code = await codeOf(interactor.setPaymentStatus({ id: 'p2', status: PaymentStatusEnum.COMPLETED } as any));
    expect(code).toBe('GATEWAY_PAYMENT_STATUS_CHANGE_FORBIDDEN');
    expect(paymentRepository.setPaymentStatus).not.toHaveBeenCalled();
  });

  it('системную выплату «ожидает решения совета» платежом не завести — только заявкой', async () => {
    const { interactor } = makeInteractor(null);
    const code = await codeOf(
      interactor.createSystemOutgoingPayment({ payment_hash: 'h', status: PaymentStatusEnum.AWAITING_AUTHORIZATION } as any)
    );
    expect(code).toBe('GATEWAY_PAYOUT_BEFORE_COUNCIL_FORBIDDEN');
  });

  it('несуществующий платёж — «не найден»', async () => {
    const { interactor } = makeInteractor(null);
    const code = await codeOf(interactor.setPaymentStatus({ id: 'nope', status: PaymentStatusEnum.PAID } as any));
    expect(code).toBe('GATEWAY_PAYMENT_NOT_FOUND');
  });
});

describe('взнос — срок оплаты трое суток по шкале времени стенда', () => {
  function depositInteractor() {
    let created: any = null;
    const paymentRepository = {
      expireOutdatedPayments: jest.fn(async () => undefined),
      findActivePendingPayment: jest.fn(async () => null),
      create: jest.fn(async (data: any) => (created = { ...data, id: 'p1' })),
      update: jest.fn(async () => null),
      findById: jest.fn(async () => created),
    } as any;
    const providerPort = { getProvider: () => ({ createPayment: async () => ({ data: {} }) }) } as any;
    const systemDomainPort = { getSettings: async () => ({ provider_name: 'qrpay' }) } as any;
    const stub = {} as any;
    const interactor = new GatewayInteractor(stub, paymentRepository, stub, providerPort, systemDomainPort, stub, stub, stub, stub);
    return { interactor, created: () => created };
  }
  const saved = process.env.STAND_DAY_SECONDS;
  afterEach(() => {
    if (saved === undefined) delete process.env.STAND_DAY_SECONDS;
    else process.env.STAND_DAY_SECONDS = saved;
  });

  it('в работе — 72 часа от создания: неоплаченный взнос истекает, а не висит «в работе» вечно', async () => {
    delete process.env.STAND_DAY_SECONDS;
    const { interactor, created } = depositInteractor();
    await interactor.createDeposit({ username: 'ivanov', quantity: 100, symbol: 'RUB' } as any);
    const p = created();
    expect(p.expired_at.getTime() - p.created_at.getTime()).toBe(72 * 60 * 60 * 1000);
  });

  it('на стенде с минутными сутками — три минуты', async () => {
    process.env.STAND_DAY_SECONDS = '60';
    const { interactor, created } = depositInteractor();
    await interactor.createDeposit({ username: 'ivanov', quantity: 100, symbol: 'RUB' } as any);
    const p = created();
    expect(p.expired_at.getTime() - p.created_at.getTime()).toBe(3 * 60 * 1000);
  });
});
