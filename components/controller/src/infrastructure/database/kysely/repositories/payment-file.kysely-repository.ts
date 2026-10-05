import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type { PaymentFileRepository } from '~/domain/gateway/repositories/payment-file.repository';
import type { IPaymentFileDatabaseData } from '~/domain/gateway/interfaces/payment-file-database.interface';
import type { PaymentFiles } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

function toDomain(row: Selectable<PaymentFiles>): IPaymentFileDatabaseData {
  return {
    id: row.id,
    coopname: row.coopname,
    payment_hash: row.payment_hash,
    kind: row.kind as IPaymentFileDatabaseData['kind'],
    checksum_sha256: row.checksum_sha256,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    storage_key: row.storage_key,
    original_filename: row.original_filename,
    uploaded_by_username: row.uploaded_by_username,
    uploaded_at: row.uploaded_at,
  };
}

/** Файлы, приложенные к платежам (таблица `payment_files`). */
@Injectable()
export class PaymentFileKyselyRepository implements PaymentFileRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(data: IPaymentFileDatabaseData): Promise<IPaymentFileDatabaseData> {
    const row = await this.db
      .insertInto('payment_files')
      .values({
        coopname: data.coopname,
        payment_hash: data.payment_hash,
        kind: data.kind as Selectable<PaymentFiles>['kind'],
        checksum_sha256: data.checksum_sha256,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        storage_key: data.storage_key,
        original_filename: data.original_filename ?? null,
        uploaded_by_username: data.uploaded_by_username,
        ...(data.uploaded_at ? { uploaded_at: data.uploaded_at } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findById(id: number): Promise<IPaymentFileDatabaseData | null> {
    const row = await this.db.selectFrom('payment_files').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByChecksum(coopname: string, checksum: string): Promise<IPaymentFileDatabaseData | null> {
    const row = await this.db
      .selectFrom('payment_files')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('checksum_sha256', '=', checksum)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  /** Файлы платежа, новые сверху. */
  async findByPayment(coopname: string, paymentHash: string): Promise<IPaymentFileDatabaseData[]> {
    const rows = await this.db
      .selectFrom('payment_files')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('payment_hash', '=', paymentHash.toLowerCase())
      .orderBy('uploaded_at', 'desc')
      .execute();
    return rows.map(toDomain);
  }

  async delete(id: number): Promise<void> {
    await this.db.deleteFrom('payment_files').where('id', '=', id).execute();
  }
}
