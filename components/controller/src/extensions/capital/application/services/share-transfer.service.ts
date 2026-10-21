import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DomainError,
  platformSettings,
  verifySignedDocumentAgainstStoredDraft,
  type PaginationInputDTO,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import {
  CHAIN_DELTA_WAIT_PORT,
  DOCUMENT_PORT,
  USER_WALLET_PORT,
  type IChainDeltaWaitPort,
  type IDocumentPort,
  type IUserWalletPort,
  type InnerTransactResult,
} from '@coopenomics/innercoop';
import { Ledger2Contract } from 'cooptypes';
import { CAPITAL_BLOCKCHAIN_PORT, type CapitalBlockchainPort } from '../../domain/interfaces/capital-blockchain.port';
import { CONTRIBUTOR_REPOSITORY, type ContributorRepository } from '../../domain/repositories/contributor.repository';
import { ShareTransferKyselyRepository } from '../../infrastructure/repositories/share-transfer.kysely-repository';
import type { ShareTransferRecord } from '../../infrastructure/entities/share-transfer.record';
import type { TransferShareInputDTO } from '../dto/share_transfer/transfer-share-input.dto';
import type { ShareTransferStateDTO } from '../dto/share_transfer/share-transfer-state.dto';
import type { ShareTransferDTO } from '../dto/share_transfer/share-transfer.dto';

/** Кошелёк паевого взноса пайщика в Благоросте (ledger2, L3). */
export const BLAGOROST_SHARE_WALLET = 'w.cap.blago';

/**
 * Трансляция паевого взноса из Благороста в Цифровой Кошелёк — временный
 * приоритетный путь к возврату для пайщиков, которым председатель выдал
 * доступ (роль `blagorost-transfer`, проверяет гард операции).
 *
 * Пайщик называет сумму, подписывает заявление (1090), сервер сверяет его с
 * сохранённым черновиком и остатком кошелька и отправляет `capital::wthshare`.
 * Деньги двигает контракт: он сам сверяет остаток, фиксирует начисления
 * программы и проводит o.cap.wthcap. Возврат с Цифрового Кошелька пайщик
 * оформляет отдельно штатным заявлением о возврате.
 */
@Injectable()
export class ShareTransferService {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT) private readonly chain: CapitalBlockchainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(USER_WALLET_PORT) private readonly wallets: IUserWalletPort,
    @Inject(CONTRIBUTOR_REPOSITORY) private readonly contributors: ContributorRepository,
    private readonly transfers: ShareTransferKyselyRepository,
    @Optional() @Inject(CHAIN_DELTA_WAIT_PORT) private readonly chainWait: IChainDeltaWaitPort | null = null
  ) {}

  /** Остаток паевого взноса на кошельке Благороста — столько можно транслировать. */
  async state(username: string): Promise<ShareTransferStateDTO> {
    const { coopname } = platformSettings();
    return { username, blagorost_balance: await this.balance(coopname, username) };
  }

  /** История трансляций: пайщика или, без имени, всего кооператива. */
  async list(username: string | undefined, options?: PaginationInputDTO): Promise<PaginationResult<ShareTransferDTO>> {
    const { coopname } = platformSettings();
    const page = await this.transfers.list(coopname, username, options);
    const names = await this.displayNames(coopname, page.items);
    return { ...page, items: page.items.map((r) => this.toDTO(r, names.get(r.username))) };
  }

  /**
   * Трансляция по подписанному заявлению. Правило контракта «не больше
   * остатка» проверяется здесь заранее — пайщик узнаёт о нём до цепи.
   */
  async transfer(data: TransferShareInputDTO): Promise<ShareTransferStateDTO> {
    const amount = this.chainAmount(data.amount);
    const balance = await this.balance(data.coopname, data.username);
    if (Number.parseFloat(amount) > Number.parseFloat(balance)) {
      throw DomainError.badRequest('CAPITAL_SHARE_TRANSFER_INSUFFICIENT');
    }
    // Заявление — то самое, что сгенерировал сервер, и на ту же сумму.
    await verifySignedDocumentAgainstStoredDraft(
      (docHash) => this.documents.getByHash(docHash),
      data.statement,
      [{ field: 'amount', expected: amount, mode: 'currency_amount' }]
    );

    // Одно заявление — одна трансляция: строка резервируется до цепи, повтор
    // того же заявления получает отказ здесь, а не второе списание в цепи.
    const reserved = await this.transfers.reserve({
      coopname: data.coopname,
      username: data.username,
      amount,
      statement_hash: data.statement.hash.toLowerCase(),
      statement: data.statement as unknown as Record<string, unknown>,
    });

    let tx: InnerTransactResult;
    try {
      tx = await this.chain.transferShare({
        coopname: data.coopname,
        username: data.username,
        amount,
        statement: data.statement as never,
      });
    } catch (error) {
      await this.transfers.release(reserved._id);
      throw error;
    }
    await this.transfers.confirm(reserved._id, this.transactionId(tx));

    // Ответ после факта из цепи: стол сразу перечитывает остаток пайщика.
    await this.chainWait?.afterTransact(tx, [
      {
        code: Ledger2Contract.contractName.production,
        table: Ledger2Contract.Tables.UserWallets.tableName,
        scope: data.coopname,
        match: (d: { value?: Record<string, unknown> }) => d.value?.username === data.username,
      },
    ]);
    return this.state(data.username);
  }

  /** Сумма в виде цепи: больше нуля и в валюте кооператива. */
  private chainAmount(raw: string): string {
    const { rootGovernSymbol, rootGovernPrecision } = platformSettings().blockchain;
    const [value, symbol] = raw.trim().split(/\s+/);
    const parsed = Number.parseFloat(value ?? '');
    if (!Number.isFinite(parsed) || parsed <= 0 || (symbol && symbol !== rootGovernSymbol)) {
      throw DomainError.badRequest('CAPITAL_SHARE_TRANSFER_AMOUNT_INVALID');
    }
    return `${parsed.toFixed(rootGovernPrecision)} ${rootGovernSymbol}`;
  }

  private async balance(coopname: string, username: string): Promise<string> {
    const { rootGovernSymbol, rootGovernPrecision } = platformSettings().blockchain;
    const wallet = await this.wallets.findByWalletAndUsername(coopname, BLAGOROST_SHARE_WALLET, username);
    return wallet?.available ?? `${(0).toFixed(rootGovernPrecision)} ${rootGovernSymbol}`;
  }

  private async displayNames(coopname: string, rows: ShareTransferRecord[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const username of new Set(rows.map((r) => r.username))) {
      const contributor = await this.contributors.findByUsernameAndCoopname(username, coopname);
      names.set(username, contributor?.display_name || username);
    }
    return names;
  }

  private transactionId(tx: InnerTransactResult): string {
    return String(tx?.response?.transaction_id ?? tx?.resolved?.transaction?.id ?? '');
  }

  private toDTO(r: ShareTransferRecord, displayName?: string): ShareTransferDTO {
    return {
      _id: r._id,
      username: r.username,
      display_name: displayName ?? r.username,
      amount: r.amount,
      statement_hash: r.statement_hash,
      transaction_id: r.transaction_id,
      created_at: r.created_at,
    };
  }
}
