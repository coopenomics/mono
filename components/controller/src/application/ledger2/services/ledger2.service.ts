import { Inject, Injectable } from '@nestjs/common';
import {
  LEDGER2_STATE_PORT,
  type Ledger2StatePort,
} from '~/domain/ledger2/ports/ledger2-state.port';
import type { Ledger2AccountDTO } from '../dto/ledger2-account.dto';
import type { Ledger2WalletDTO } from '../dto/ledger2-wallet.dto';
import type {
  Ledger2HistoryResponseDTO,
  Ledger2OperationDTO,
} from '../dto/ledger2-operation.dto';
import type { GetLedger2HistoryInputDTO } from '../dto/get-ledger2-history-input.dto';

@Injectable()
export class Ledger2Service {
  constructor(@Inject(LEDGER2_STATE_PORT) private readonly port: Ledger2StatePort) {}

  async getAccounts(coopname: string): Promise<Ledger2AccountDTO[]> {
    return this.port.getAccounts(coopname);
  }

  async getWallets(coopname: string): Promise<Ledger2WalletDTO[]> {
    return this.port.getWallets(coopname);
  }

  async getHistory(input: GetLedger2HistoryInputDTO): Promise<Ledger2HistoryResponseDTO> {
    const resp = await this.port.getHistory(input);
    const items: Ledger2OperationDTO[] = resp.items.map((op) => ({
      globalSequence: String(op.globalSequence),
      blockNum: op.blockNum,
      coopname: op.coopname,
      action: op.action,
      actionCode: op.actionCode,
      processHash: op.processHash,
      username: op.username,
      accountId: op.accountId,
      quantity: op.quantity,
      memo: op.memo,
      createdAt: op.createdAt,
    }));
    return {
      items,
      totalCount: resp.totalCount,
      totalPages: resp.totalPages,
      currentPage: resp.currentPage,
    };
  }
}
