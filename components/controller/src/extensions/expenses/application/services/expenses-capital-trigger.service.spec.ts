import type { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ExpensesCapitalTriggerService,
  EXPENSE_CAPITALIZATION_REQUIRED,
} from './expenses-capital-trigger.service';
import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';
import type { ExpenseProposalRepository } from '../../domain/repositories/expense-proposal.repository';
import type { WinstonLoggerService } from '~/application/logger/logger-app.service';

function makeProposal(
  status: ExpenseProposalStatus,
  total_actual?: string
): ExpenseProposalDomainEntity {
  return {
    proposal_hash: '0xabc',
    coopname: 'voskhod',
    username: 'creator',
    status,
    total_actual: total_actual ?? '1500.0000 RUB',
  } as unknown as ExpenseProposalDomainEntity;
}

function makeProposalWithoutTotal(status: ExpenseProposalStatus): ExpenseProposalDomainEntity {
  return {
    proposal_hash: '0xabc',
    coopname: 'voskhod',
    status,
  } as unknown as ExpenseProposalDomainEntity;
}

function makeLogger(): WinstonLoggerService & {
  log: jest.Mock;
  warn: jest.Mock;
  setContext: jest.Mock;
} {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    setContext: jest.fn(),
  } as unknown as WinstonLoggerService & {
    log: jest.Mock;
    warn: jest.Mock;
    setContext: jest.Mock;
  };
}

describe('ExpensesCapitalTriggerService', () => {
  let service: ExpensesCapitalTriggerService;
  let logger: ReturnType<typeof makeLogger>;
  let proposals: ExpenseProposalRepository;
  let eventEmitter: EventEmitter2 & { emit: jest.Mock };

  beforeEach(() => {
    logger = makeLogger();
    proposals = {} as ExpenseProposalRepository;
    eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2 & { emit: jest.Mock };
    service = new ExpensesCapitalTriggerService(proposals, eventEmitter, logger);
  });

  it('ничего не делает для не-CLOSED статуса', async () => {
    await service.handleProposalSynced({
      entity: makeProposal(ExpenseProposalStatus.REPORT_SUBMITTED),
      blockNum: 100,
    });
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('ничего не делает для AUTHORIZED (не финальный статус)', async () => {
    await service.handleProposalSynced({
      entity: makeProposal(ExpenseProposalStatus.AUTHORIZED),
      blockNum: 100,
    });
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('warn без total_actual при CLOSED', async () => {
    await service.handleProposalSynced({
      entity: makeProposalWithoutTotal(ExpenseProposalStatus.CLOSED),
      blockNum: 100,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('capitalization не запускается'));
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('эмитит EXPENSE_CAPITALIZATION_REQUIRED для CLOSED + total_actual', async () => {
    await service.handleProposalSynced({
      entity: makeProposal(ExpenseProposalStatus.CLOSED, '1500.0000 RUB'),
      blockNum: 100,
    });
    expect(logger.log).toHaveBeenCalledTimes(1);
    const message = logger.log.mock.calls[0][0] as string;
    expect(message).toContain('0xabc');
    expect(message).toContain('1500.0000 RUB');
    expect(message).toContain('100');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EXPENSE_CAPITALIZATION_REQUIRED,
      expect.objectContaining({
        coopname: 'voskhod',
        proposal_hash: '0xabc',
        username: 'creator',
        total_actual: '1500.0000 RUB',
        block_num: 100,
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('игнорирует DECLINED (capitalization не запускается)', async () => {
    await service.handleProposalSynced({
      entity: makeProposal(ExpenseProposalStatus.DECLINED),
      blockNum: 100,
    });
    expect(logger.log).not.toHaveBeenCalled();
  });
});
