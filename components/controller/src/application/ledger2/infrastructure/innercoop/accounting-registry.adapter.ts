import { Injectable } from '@nestjs/common';
import type { IAccountingRegistryPort, InnerRegistryRecord } from '@coopenomics/innercoop';
import type { GetLedger2HistoryInputDTO, GetLedger2PostingsInputDTO, PaginationInputDTO } from '@coopenomics/extension-kit';
import { ProcessRegistryService } from '~/domain/process-registry/services/process-registry.service';
import { Ledger2Service } from '../../services/ledger2.service';

/**
 * Реестры бухгалтерии и процессов для приложений (C28-90): те же сервисы,
 * что стоят за операциями ядра, без проверки прав. Доступ проверяет операция
 * приложения по своей таблице прав до вызова порта.
 */
@Injectable()
export class AccountingRegistryInnercoopAdapter implements IAccountingRegistryPort {
  constructor(
    private readonly ledger2Service: Ledger2Service,
    private readonly processRegistryService: ProcessRegistryService
  ) {}

  ledgerAccounts(coopname: string): Promise<InnerRegistryRecord[]> {
    return this.ledger2Service.getAccounts(coopname);
  }

  ledgerWallets(coopname: string): Promise<InnerRegistryRecord[]> {
    return this.ledger2Service.getWallets(coopname);
  }

  ledgerHistory(input: InnerRegistryRecord): Promise<InnerRegistryRecord> {
    return this.ledger2Service.getHistory(input as GetLedger2HistoryInputDTO);
  }

  ledgerPostings(input: InnerRegistryRecord): Promise<InnerRegistryRecord> {
    return this.ledger2Service.getPostings(input as GetLedger2PostingsInputDTO);
  }

  process(hash: string, coopname: string): Promise<InnerRegistryRecord> {
    return this.processRegistryService.getProcess(hash, coopname);
  }

  processes(filter: InnerRegistryRecord, pagination: InnerRegistryRecord): Promise<InnerRegistryRecord> {
    return this.processRegistryService.listProcesses(
      filter as Parameters<ProcessRegistryService['listProcesses']>[0],
      pagination as PaginationInputDTO
    );
  }
}
