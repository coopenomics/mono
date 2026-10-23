import { Inject, Injectable } from '@nestjs/common';
import { DomainError, PaginationUtils, type PaginationInputDTO, type PaginationResult, type TableStore } from '@coopenomics/extension-kit';
import { CAPITAL_SHARE_TRANSFER_STORE } from '../database/capital-stores';
import type { ShareTransferRecord } from '../entities/share-transfer.record';

const PG_UNIQUE_VIOLATION = '23505';

/** История трансляций паевого взноса в Цифровой Кошелёк (`capital_share_transfers`). */
@Injectable()
export class ShareTransferKyselyRepository {
  constructor(@Inject(CAPITAL_SHARE_TRANSFER_STORE) private readonly store: TableStore<ShareTransferRecord>) {}

  /**
   * Резерв строки до отправки в цепь. Одно заявление — одна трансляция:
   * повтор (двойное нажатие, повторная отправка того же подписанного
   * заявления) упирается в уникальный индекс по хэшу заявления.
   */
  async reserve(data: Pick<ShareTransferRecord, 'coopname' | 'username' | 'amount' | 'statement_hash' | 'statement'>): Promise<ShareTransferRecord> {
    try {
      return await this.store.insert({ ...data, transaction_id: '', confirmed: false });
    } catch (error) {
      if (String((error as { code?: unknown })?.code) === PG_UNIQUE_VIOLATION) {
        throw DomainError.conflict('CAPITAL_SHARE_TRANSFER_STATEMENT_USED');
      }
      throw error;
    }
  }

  async confirm(id: string, transactionId: string): Promise<void> {
    await this.store.update({ _id: id }, { transaction_id: transactionId, confirmed: true });
  }

  /** Цепь отказала — резерв снимается, заявление можно подать заново. */
  async release(id: string): Promise<void> {
    await this.store.delete({ _id: id, confirmed: false });
  }

  /** Подтверждённые трансляции, новые сверху; без пайщика — история всего кооператива. */
  async list(coopname: string, username: string | undefined, options?: PaginationInputDTO): Promise<PaginationResult<ShareTransferRecord>> {
    const validated = PaginationUtils.validatePaginationOptions(options ?? { page: 1, limit: 20, sortOrder: 'DESC' });
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validated);
    const where: Partial<ShareTransferRecord> = username ? { coopname, username, confirmed: true } : { coopname, confirmed: true };
    const [items, total] = await this.store.findAndCount(where, { order: { created_at: 'DESC' }, limit, offset });
    return PaginationUtils.createPaginationResult(items, total, validated);
  }
}
