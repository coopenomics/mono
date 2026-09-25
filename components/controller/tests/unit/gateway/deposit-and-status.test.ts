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
  const interactor = new GatewayInteractor(stub, paymentRepository, stub, stub, stub, stub, stub, stub);
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

  it('несуществующий платёж — «не найден»', async () => {
    const { interactor } = makeInteractor(null);
    const code = await codeOf(interactor.setPaymentStatus({ id: 'nope', status: PaymentStatusEnum.PAID } as any));
    expect(code).toBe('GATEWAY_PAYMENT_NOT_FOUND');
  });
});
