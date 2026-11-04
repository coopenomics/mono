import { WithdrawAuthorizationListener } from '~/application/gateway/services/withdraw-authorization.listener';
import { PayoutRequestService } from '~/application/gateway/services/payout-request.service';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentDirectionEnum, PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import { PayoutRequestStatusEnum } from '~/domain/gateway/repositories/payout-request.repository';
import type { PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import type { PayoutRequestRepository } from '~/domain/gateway/repositories/payout-request.repository';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

/**
 * Решение совета по возврату паевого взноса (решение владельца 04.11.2026):
 * при подаче сохраняется заявка на выплату, платёж кассиру создаёт решение
 * совета. До решения платежа нет — кассир его не видит и тронуть не может.
 *
 * Регресс прошлых лет остаётся в силе:
 *  - `wallet::authwthd` объявлен через AUTHORIZE_CALLBACK_SIGNATURE и несёт
 *    поле `hash`, а не `withdraw_hash`;
 *  - блокчейн отдаёт checksum256 в верхнем регистре, заявка и платёж хранятся в
 *    нижнем;
 *  - платёж «ожидает решения совета», заведённый до заявок, решение совета
 *    переводит кассиру, как раньше.
 */
describe('WithdrawAuthorizationListener — возврат паевого взноса по решению совета', () => {
  const HASH_LOWER = '06a160d16630484bbe4df9eb2a768b3b2838a2a1fee6ccb135384630c3963eda';
  const HASH_UPPER = HASH_LOWER.toUpperCase();
  const PAYMENT_ID = '82d129b0-f25f-4815-9873-2efc4b78e97f';

  const request = (status = PayoutRequestStatusEnum.AWAITING) => ({
    id: 'r1',
    hash: HASH_LOWER,
    coopname: 'voskhod',
    username: 'ivanpetrov',
    quantity: 1500,
    symbol: 'RUB',
    type: PaymentTypeEnum.WITHDRAWAL,
    provider: 'qrpay',
    payment_method_id: 'm1',
    memo: 'Возврат паевого взноса',
    expired_at: new Date(-1),
    payment_details: { data: { phone: '+79990001231' } } as never,
    blockchain_data: null,
    statement: { hash: 'doc' },
    related_extension: null,
    related_entity_id: null,
    status,
    decided_at: null,
    created_at: new Date('2026-11-04T09:00:00Z'),
    updated_at: new Date('2026-11-04T09:00:00Z'),
  });

  let payments: jest.Mocked<Pick<PaymentRepository, 'findByHash' | 'setPaymentStatus' | 'create'>>;
  let requests: jest.Mocked<PayoutRequestRepository>;
  let listener: WithdrawAuthorizationListener;

  const action = (data: Record<string, unknown>): ActionDomainInterface =>
    ({ data } as unknown as ActionDomainInterface);

  beforeEach(() => {
    payments = {
      findByHash: jest.fn().mockResolvedValue(null),
      setPaymentStatus: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (p) => ({ ...p, id: PAYMENT_ID })),
    };
    requests = {
      create: jest.fn(),
      findByHash: jest.fn().mockResolvedValue(request()),
      markDecided: jest.fn().mockResolvedValue(undefined),
      deleteAwaiting: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PayoutRequestService(requests, payments as unknown as PaymentRepository);
    listener = new WithdrawAuthorizationListener(service);
  });

  describe('authwthd — совет разрешил', () => {
    it('создаёт платёж кассиру «ожидает» из заявки: сумма, реквизиты, назначение — как при подаче', async () => {
      await listener.onAuthWithdraw(action({ coopname: 'voskhod', hash: HASH_UPPER }));

      expect(requests.findByHash).toHaveBeenCalledWith(HASH_LOWER);
      expect(payments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: HASH_LOWER,
          username: 'ivanpetrov',
          quantity: 1500,
          type: PaymentTypeEnum.WITHDRAWAL,
          direction: PaymentDirectionEnum.OUTGOING,
          status: PaymentStatusEnum.PENDING,
          payment_method_id: 'm1',
          memo: 'Возврат паевого взноса',
        })
      );
      expect(requests.markDecided).toHaveBeenCalledWith(HASH_LOWER, PayoutRequestStatusEnum.RELEASED);
    });

    it('повтор события: платёж уже создан — второй не заводится', async () => {
      payments.findByHash.mockResolvedValue({ id: PAYMENT_ID, status: PaymentStatusEnum.PENDING } as never);

      await listener.onAuthWithdraw(action({ hash: HASH_UPPER }));

      expect(payments.create).not.toHaveBeenCalled();
      expect(payments.setPaymentStatus).not.toHaveBeenCalled();
    });

    it('платёж «ожидает решения совета», заведённый до заявок, переводится кассиру', async () => {
      requests.findByHash.mockResolvedValue(null);
      payments.findByHash.mockResolvedValue({ id: PAYMENT_ID, status: PaymentStatusEnum.AWAITING_AUTHORIZATION } as never);

      await listener.onAuthWithdraw(action({ coopname: 'voskhod', hash: HASH_UPPER }));

      expect(payments.setPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID, PaymentStatusEnum.PENDING);
      expect(payments.create).not.toHaveBeenCalled();
    });

    it('заявка отклонена ранее — платёж не создаётся', async () => {
      requests.findByHash.mockResolvedValue(request(PayoutRequestStatusEnum.DECLINED));

      await listener.onAuthWithdraw(action({ hash: HASH_UPPER }));

      expect(payments.create).not.toHaveBeenCalled();
    });

    it('не реагирует на withdraw_hash — у этого действия поля с таким именем нет', async () => {
      await listener.onAuthWithdraw(action({ coopname: 'voskhod', withdraw_hash: HASH_UPPER }));

      expect(requests.findByHash).not.toHaveBeenCalled();
      expect(payments.create).not.toHaveBeenCalled();
    });

    it('ни заявки, ни платежа — ничего не создаётся', async () => {
      requests.findByHash.mockResolvedValue(null);

      await listener.onAuthWithdraw(action({ hash: HASH_UPPER }));

      expect(payments.create).not.toHaveBeenCalled();
    });
  });

  describe('declinewthd — совет отказал', () => {
    it('закрывает заявку, платёж не создаётся', async () => {
      await listener.onDeclineWithdraw(action({ withdraw_hash: HASH_UPPER, reason: 'нет средств' }));

      expect(requests.markDecided).toHaveBeenCalledWith(HASH_LOWER, PayoutRequestStatusEnum.DECLINED);
      expect(payments.create).not.toHaveBeenCalled();
    });

    it('платёж, если он уже был, отменяется', async () => {
      payments.findByHash.mockResolvedValue({ id: PAYMENT_ID, status: PaymentStatusEnum.AWAITING_AUTHORIZATION } as never);

      await listener.onDeclineWithdraw(action({ withdraw_hash: HASH_UPPER }));

      expect(payments.setPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID, PaymentStatusEnum.CANCELLED);
    });

    it('не отменяет уже завершённый платёж', async () => {
      payments.findByHash.mockResolvedValue({ id: PAYMENT_ID, status: PaymentStatusEnum.COMPLETED } as never);

      await listener.onDeclineWithdraw(action({ withdraw_hash: HASH_UPPER }));

      expect(payments.setPaymentStatus).not.toHaveBeenCalled();
    });
  });
});

describe('PayoutRequestService.register — заявка вместо платежа при подаче', () => {
  it('хэш занят платежом или заявкой — отказ GATEWAY_PAYMENT_HASH_DUPLICATE', async () => {
    const payments = { findByHash: jest.fn().mockResolvedValue({ id: 'p' }) } as unknown as PaymentRepository;
    const requests = { findByHash: jest.fn().mockResolvedValue(null), create: jest.fn() } as unknown as PayoutRequestRepository;
    const service = new PayoutRequestService(requests, payments);

    await expect(service.register({ hash: 'AB', coopname: 'c', username: 'u', quantity: 1, symbol: 'RUB' } as never)).rejects.toMatchObject({
      code: 'GATEWAY_PAYMENT_HASH_DUPLICATE',
    });
    expect((requests as any).create).not.toHaveBeenCalled();
  });

  it('новая заявка сохраняется с хэшем в нижнем регистре и реквизитами черновика', async () => {
    const payments = { findByHash: jest.fn().mockResolvedValue(null) } as unknown as PaymentRepository;
    const create = jest.fn(async (d) => ({ ...d, id: 'r', status: PayoutRequestStatusEnum.AWAITING }));
    const requests = { findByHash: jest.fn().mockResolvedValue(null), create } as unknown as PayoutRequestRepository;
    const service = new PayoutRequestService(requests, payments);

    await service.register({ hash: 'AB', coopname: 'c', username: 'u', quantity: 300, symbol: 'RUB', type: PaymentTypeEnum.AID, payment_method_id: 'm1' } as never);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ hash: 'ab', quantity: 300, payment_method_id: 'm1', type: PaymentTypeEnum.AID }));
  });
});
