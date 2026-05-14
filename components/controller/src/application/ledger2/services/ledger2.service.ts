import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Ledger2 } from 'cooptypes';
import {
  LEDGER2_STATE_PORT,
  type Ledger2StatePort,
} from '~/domain/ledger2/ports/ledger2-state.port';
import {
  LEDGER2_BLOCKCHAIN_PORT,
  type Ledger2BlockchainPort,
} from '~/domain/ledger2/ports/ledger2-blockchain.port';
import type { Ledger2AccountDTO } from '../dto/ledger2-account.dto';
import type { Ledger2WalletDTO } from '../dto/ledger2-wallet.dto';
import type {
  Ledger2HistoryResponseDTO,
  Ledger2OperationDTO,
} from '../dto/ledger2-operation.dto';
import type {
  Ledger2PostingDTO,
  Ledger2PostingsResponseDTO,
} from '../dto/ledger2-posting.dto';
import type { GetLedger2HistoryInputDTO } from '../dto/get-ledger2-history-input.dto';
import type { GetLedger2PostingsInputDTO } from '../dto/get-ledger2-postings-input.dto';
import type { WalmoveInputDTO } from '../dto/walmove-input.dto';
import type { Ledger2AdjustmentResultDTO } from '../dto/ledger2-adjustment-result.dto';

@Injectable()
export class Ledger2Service {
  constructor(
    @Inject(LEDGER2_STATE_PORT) private readonly port: Ledger2StatePort,
    @Inject(LEDGER2_BLOCKCHAIN_PORT) private readonly blockchainPort: Ledger2BlockchainPort,
  ) {}

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
      operationCode: op.operationCode,
      processHash: op.processHash,
      username: op.username,
      accountId: op.accountId,
      walletFrom: op.walletFrom,
      walletTo: op.walletTo,
      quantity: op.quantity,
      memo: op.memo,
      parentApplyGlobalSequence: op.parentApplyGlobalSequence,
      createdAt: op.createdAt,
    }));
    return {
      items,
      totalCount: resp.totalCount,
      totalPages: resp.totalPages,
      currentPage: resp.currentPage,
    };
  }

  async getPostings(input: GetLedger2PostingsInputDTO): Promise<Ledger2PostingsResponseDTO> {
    const resp = await this.port.getPostings(input);
    const items: Ledger2PostingDTO[] = resp.items.map((p) => ({
      key: p.key,
      blockNum: p.blockNum,
      processHash: p.processHash,
      operationCode: p.operationCode,
      parentApplyGlobalSequence: p.parentApplyGlobalSequence,
      debitGlobalSequence: p.debitGlobalSequence,
      debitAccountId: p.debitAccountId,
      creditGlobalSequence: p.creditGlobalSequence,
      creditAccountId: p.creditAccountId,
      quantity: p.quantity,
      memo: p.memo,
      username: p.username,
      createdAt: p.createdAt,
    }));
    return {
      items,
      totalCount: resp.totalCount,
      totalPages: resp.totalPages,
      currentPage: resp.currentPage,
    };
  }

  /**
   * Перевод между кошельками одного бух.счёта (operation `o.adj.walmove`).
   *
   * Backend проверяет связь wallet→account через `Ledger2.LEDGER2_OPERATION_REGISTRY`:
   * для каждого кошелька выводит уникальный `account_id` (debit или credit), куда он
   * привязан в стандартных операциях. Если у двух кошельков разные account_id —
   * отказ ДО подписания (контракт связь не хранит, эта проверка — только здесь).
   *
   * Revert (`o.adj.rev`) намеренно не имеет UI-вход: action `ledger2::revert`
   * принимает только подпись от whitelisted-контрактов (см. revert.cpp). Зеркальная
   * проводка председателем top-level рассинхронизирует состояние контрактов-инициаторов
   * (registrator/wallet/capital), их данные не трогаются. Если контракт-инициатор
   * хочет откатить свой flow — он сам инициирует ledger2::revert.
   */
  async walmove(input: WalmoveInputDTO): Promise<Ledger2AdjustmentResultDTO> {
    if (input.fromWallet === input.toWallet) {
      throw new BadRequestException('walmove: from_wallet и to_wallet не должны совпадать');
    }
    const fromAccountId = this.resolveWalletAccountId(input.fromWallet);
    const toAccountId = this.resolveWalletAccountId(input.toWallet);
    if (fromAccountId === null || toAccountId === null) {
      throw new BadRequestException(
        `walmove: не удалось определить account_id для кошельков ${input.fromWallet} / ${input.toWallet}`,
      );
    }
    if (fromAccountId !== toAccountId) {
      throw new BadRequestException(
        `walmove: from_wallet и to_wallet принадлежат разным бух.счетам (${fromAccountId} ≠ ${toAccountId}). ` +
          `Перевод между разными счетами требует Manual-корректировки через решение совета (отложено).`,
      );
    }

    const processHash = this.generateProcessHash();
    const result = await this.blockchainPort.walmove({
      coopname: input.coopname,
      initiator: input.coopname,
      username: input.username,
      fromWallet: input.fromWallet,
      toWallet: input.toWallet,
      quantity: input.quantity,
      processHash,
      memo: input.memo,
    });

    return {
      processHash,
      transactionId: this.extractTransactionId(result),
    };
  }

  /**
   * Привязка кошелька к бух.счёту по `LEDGER2_OPERATION_REGISTRY`:
   * берём первую стандартную операцию, где этот wallet появляется как
   * wallet_from или wallet_to, и возвращаем соответствующий счёт (credit для
   * wallet_from, debit для wallet_to — для standard-flow). Все стандартные
   * кошельки имеют **один** account_id во всех операциях, поэтому первая
   * найденная привязка достаточна.
   *
   * `walletName` — eosio::name кошелька (`w.<contract>.<waltype>`).
   */
  private resolveWalletAccountId(walletName: string): number | null {
    for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
      if (op.kind === 'adjustment') continue;
      // Записи без бухпроводок (debit == null && credit == null, ADR-003) — пропускаем
      if (op.debit === null && op.credit === null) continue;
      if (op.wallet_from === walletName && op.credit !== null) return op.credit;
      if (op.wallet_to === walletName && op.credit !== null && op.wallet_op === 'ISSUE') return op.credit;
      if (op.wallet_to === walletName && op.debit !== null) return op.debit;
      if (op.wallet_from === walletName && op.debit !== null) return op.debit;
    }
    // Кошельки, встречающиеся только в TRANSFER без бухпроводок (например w.cap.blago
    // в o.cap.invest) — выводим из источника: такой TRANSFER переносит между
    // кошельками одного счёта, значит партнёрский кошелёк имеет тот же account_id,
    // что и его пара в стандартной операции.
    for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
      if (op.kind === 'adjustment') continue;
      if (op.debit !== null || op.credit !== null) continue; // только без проводок
      if (op.wallet_from === walletName && op.wallet_to !== null) {
        return this.resolveWalletAccountId(op.wallet_to);
      }
      if (op.wallet_to === walletName && op.wallet_from !== null) {
        return this.resolveWalletAccountId(op.wallet_from);
      }
    }
    return null;
  }

  /**
   * SHA-256 hex для process_hash. Используем 32 случайных байта (без block-pin'а),
   * этого достаточно для уникальности — в blockchain_actions.process_hash
   * хранится как hex ровно длиной 64.
   */
  private generateProcessHash(): string {
    return createHash('sha256').update(randomBytes(32)).digest('hex');
  }

  private extractTransactionId(result: unknown): string {
    if (result && typeof result === 'object' && 'transaction_id' in result) {
      const tx = (result as { transaction_id?: unknown }).transaction_id;
      if (typeof tx === 'string') return tx;
    }
    if (result && typeof result === 'object' && 'response' in result) {
      const resp = (result as { response?: { transaction_id?: unknown } }).response;
      if (resp && typeof resp.transaction_id === 'string') return resp.transaction_id;
    }
    return '';
  }
}
