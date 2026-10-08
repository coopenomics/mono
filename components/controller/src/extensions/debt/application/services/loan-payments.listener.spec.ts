import { PaymentDirection, PaymentStatus, PaymentType } from '@coopenomics/innercoop';
import { LoanPaymentsListener } from './loan-payments.listener';
import { LoanDomainEntity } from '../../domain/entities/loan.entity';
import { LoanStatus } from '../../domain/enums/loan-status.enum';

jest.mock('../../i18n', () => ({ t: (key: string, params?: Record<string, unknown>) => `${key}:${params?.number ?? ''}` }));

const DEBT_HASH = 'ab12cd34'.padEnd(64, '0');

function loan(chainStatus: string, present = true): LoanDomainEntity {
  return new LoanDomainEntity(
    { debt_hash: DEBT_HASH, coopname: 'voskhod', status: LoanStatus.UNDEFINED, present, block_num: 1 } as any,
    {
      id: 1,
      coopname: 'voskhod',
      username: 'ant',
      status: chainStatus as any,
      debt_hash: DEBT_HASH,
      collateral: 'blago',
      source: 'debt',
      source_ref: '',
      amount: '1000.0000 RUB',
      remaining: '1000.0000 RUB',
      pledged: '1000.0000 RUB',
      created_at: '2026-10-06T10:00:00',
      issued_at: '1970-01-01T00:00:00',
      due_at: '2027-04-06T23:59:59',
      requested_due_at: '1970-01-01T00:00:00',
      overdue_at: '1970-01-01T00:00:00',
      statement: { meta: JSON.stringify({ method_id: 'm-1' }) } as any,
      last_pay_error: '',
      memo: '',
    }
  );
}

describe('LoanPaymentsListener', () => {
  const logger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  let payments: { findByHash: jest.Mock; create: jest.Mock; update: jest.Mock; list: jest.Mock };
  let methods: { get: jest.Mock };
  let listener: LoanPaymentsListener;

  beforeEach(() => {
    payments = { findByHash: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn(), list: jest.fn() };
    methods = { get: jest.fn().mockResolvedValue({ data: { phone: '+79990001122' } }) };
    listener = new LoanPaymentsListener(payments as any, methods as any, logger as any);
  });

  it('заводит исходящий платёж с хэшем займа, когда заём передан на выплату', async () => {
    await listener.handleLoanSynced({ entity: loan('paying'), blockNum: 1, syncResult: {} as any });

    expect(payments.create).toHaveBeenCalledTimes(1);
    const draft = payments.create.mock.calls[0][0];
    expect(draft).toMatchObject({
      hash: DEBT_HASH,
      username: 'ant',
      quantity: 1000,
      symbol: 'RUB',
      type: PaymentType.LOAN,
      direction: PaymentDirection.OUTGOING,
      status: PaymentStatus.PENDING,
      payment_method_id: 'm-1',
      related_extension: 'debt',
    });
    expect(draft.memo).toContain('AB12CD34');
    // Реквизиты кассиру — снимок платёжного метода из заявления.
    expect(methods.get).toHaveBeenCalledWith({ username: 'ant', method_id: 'm-1' });
    expect(draft.payment_details).toMatchObject({ data: { phone: '+79990001122' }, amount_plus_fee: '1000' });
  });

  it('не заводит платёж до подписи председателя', async () => {
    await listener.handleLoanSynced({ entity: loan('authorized'), blockNum: 1, syncResult: {} as any });
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('после повтора возвращает отклонённый платёж в ожидание и второго не заводит', async () => {
    payments.findByHash.mockResolvedValue({ id: 'p-1', status: PaymentStatus.CANCELLED });
    await listener.handleLoanSynced({ entity: loan('paying'), blockNum: 2, syncResult: {} as any });

    expect(payments.create).not.toHaveBeenCalled();
    expect(payments.update).toHaveBeenCalledWith('p-1', expect.objectContaining({ status: PaymentStatus.PENDING }));
  });

  it('ожидающий платёж не трогает', async () => {
    payments.findByHash.mockResolvedValue({ id: 'p-1', status: PaymentStatus.PENDING });
    await listener.handleLoanSynced({ entity: loan('paying'), blockNum: 2, syncResult: {} as any });
    expect(payments.update).not.toHaveBeenCalled();
  });
});

describe('LoanDomainEntity.resolveStatus', () => {
  it('пока строка в цепи — повторяет её состояние', () => {
    expect(LoanDomainEntity.resolveStatus(true, 'overdue', '2026-10-06T10:00:00')).toBe(LoanStatus.OVERDUE);
  });

  it('после удаления строки выданный заём закрыт, невыданный — отклонён', () => {
    expect(LoanDomainEntity.resolveStatus(false, 'issued', '2026-10-06T10:00:00')).toBe(LoanStatus.CLOSED);
    expect(LoanDomainEntity.resolveStatus(false, 'created', '1970-01-01T00:00:00')).toBe(LoanStatus.DECLINED);
  });
});
