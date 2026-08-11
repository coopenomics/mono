import { WithdrawAuthorizationListener } from '~/application/gateway/services/withdraw-authorization.listener';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

/**
 * Регресс на застрявший возврат паевого взноса: решение совета принято on-chain,
 * а платёж оставался в «Ожидает решения совета».
 *
 * Две причины, обе воспроизводятся ниже:
 *  - `wallet::authwthd` объявлен через AUTHORIZE_CALLBACK_SIGNATURE и несёт поле
 *    `hash`, слушатель же читал только `withdraw_hash`;
 *  - блокчейн отдаёт checksum256 в верхнем регистре, платёж хранится в нижнем.
 */
describe('WithdrawAuthorizationListener', () => {
  const HASH_LOWER = '06a160d16630484bbe4df9eb2a768b3b2838a2a1fee6ccb135384630c3963eda';
  const HASH_UPPER = HASH_LOWER.toUpperCase();
  const PAYMENT_ID = '82d129b0-f25f-4815-9873-2efc4b78e97f';

  let repository: jest.Mocked<Pick<PaymentRepository, 'findByHash' | 'setPaymentStatus'>>;
  let listener: WithdrawAuthorizationListener;

  const action = (data: Record<string, unknown>): ActionDomainInterface =>
    ({ data } as unknown as ActionDomainInterface);

  const awaitingPayment = { id: PAYMENT_ID, status: PaymentStatusEnum.AWAITING_AUTHORIZATION };

  beforeEach(() => {
    repository = {
      findByHash: jest.fn().mockResolvedValue(awaitingPayment),
      setPaymentStatus: jest.fn().mockResolvedValue(null),
    };
    listener = new WithdrawAuthorizationListener(repository as unknown as PaymentRepository);
  });

  describe('authwthd', () => {
    it('переводит платёж в PENDING по полю hash из ABI', async () => {
      await listener.onAuthWithdraw(action({ coopname: 'voskhod', hash: HASH_UPPER }));

      expect(repository.findByHash).toHaveBeenCalledWith(HASH_LOWER);
      expect(repository.setPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID, PaymentStatusEnum.PENDING);
    });

    it('принимает и устаревшее имя поля withdraw_hash', async () => {
      await listener.onAuthWithdraw(action({ coopname: 'voskhod', withdraw_hash: HASH_UPPER }));

      expect(repository.findByHash).toHaveBeenCalledWith(HASH_LOWER);
      expect(repository.setPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID, PaymentStatusEnum.PENDING);
    });

    it('не трогает платёж, который уже вышел из ожидания решения', async () => {
      repository.findByHash.mockResolvedValue({ id: PAYMENT_ID, status: PaymentStatusEnum.COMPLETED } as never);

      await listener.onAuthWithdraw(action({ hash: HASH_UPPER }));

      expect(repository.setPaymentStatus).not.toHaveBeenCalled();
    });

    it('молча пропускает действие без хэша', async () => {
      await listener.onAuthWithdraw(action({ coopname: 'voskhod' }));

      expect(repository.findByHash).not.toHaveBeenCalled();
      expect(repository.setPaymentStatus).not.toHaveBeenCalled();
    });

    it('пропускает, если платёж по хэшу не найден', async () => {
      repository.findByHash.mockResolvedValue(null);

      await listener.onAuthWithdraw(action({ hash: HASH_UPPER }));

      expect(repository.setPaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe('declinewthd', () => {
    it('отменяет платёж по полю withdraw_hash из ABI', async () => {
      await listener.onDeclineWithdraw(action({ withdraw_hash: HASH_UPPER, reason: 'нет средств' }));

      expect(repository.findByHash).toHaveBeenCalledWith(HASH_LOWER);
      expect(repository.setPaymentStatus).toHaveBeenCalledWith(PAYMENT_ID, PaymentStatusEnum.CANCELLED);
    });

    it('не отменяет уже завершённый платёж', async () => {
      repository.findByHash.mockResolvedValue({ id: PAYMENT_ID, status: PaymentStatusEnum.COMPLETED } as never);

      await listener.onDeclineWithdraw(action({ withdraw_hash: HASH_UPPER }));

      expect(repository.setPaymentStatus).not.toHaveBeenCalled();
    });
  });
});
