import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { InterFileStorageBucket } from '@coopenomics/inter';
import { InjectBucket, UseBucket } from '~/infrastructure/file-storage';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { ExpenseFileKind } from '../../domain/enums/expense-file-kind.enum';
import {
  EXPENSE_FILE_REPOSITORY,
  type ExpenseFileRepository,
} from '../../domain/repositories/expense-file.repository';
import type { IExpenseFileDatabaseData } from '../../domain/interfaces/expense-file-database.interface';
import { EXPENSES_BUCKET } from '../../constants/expenses-bucket';
import { UploadExpenseFileInputDTO } from '../dto/upload-expense-file.input';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/**
 * Сервис файлов расхода: загрузка в `expenses:files`, выдача read-URL, удаление + БД-метаданные.
 *
 * Ключ MinIO детерминирован: `{coopname}/{proposal_hash}/{item_hash|_proposal}/{kind}/{checksum}.{ext}`.
 * Поэтому повторная загрузка того же содержимого с тем же scope'ом идемпотентна на стороне бакета,
 * а в БД защищаемся явным `findByChecksum` (409 при дубле).
 */
@UseBucket(EXPENSES_BUCKET)
@Injectable()
export class ExpenseFilesService {
  constructor(
    @InjectBucket() private readonly bucket: InterFileStorageBucket,
    @Inject(EXPENSE_FILE_REPOSITORY) private readonly files: ExpenseFileRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository
  ) {}

  async uploadFile(
    input: UploadExpenseFileInputDTO,
    uploadedByUsername: string
  ): Promise<{ data: IExpenseFileDatabaseData; readUrl: string }> {
    const body = Buffer.from(input.content_base64, 'base64');
    if (body.byteLength !== input.size_bytes) {
      throw new BadRequestException(
        `size_bytes (${input.size_bytes}) не совпадает с фактическим размером base64-контента (${body.byteLength}).`
      );
    }
    const actualChecksum = createHash('sha256').update(body).digest('hex');
    if (actualChecksum !== input.checksum_sha256.toLowerCase()) {
      throw new BadRequestException(
        `checksum_sha256 не совпадает с реальным SHA-256 содержимого.`
      );
    }

    const existing = await this.files.findByChecksum(input.coopname, actualChecksum);
    if (existing) {
      throw new ConflictException(
        `Файл с таким SHA-256 уже зарегистрирован в этом кооперативе (id=${existing.id}).`
      );
    }

    const storageKey = this.buildKey({
      coopname: input.coopname,
      proposalHash: input.proposal_hash,
      itemHash: input.item_hash ?? null,
      kind: input.kind,
      checksum: actualChecksum,
      mimeType: input.mime_type,
    });

    await this.bucket.put(storageKey, new Uint8Array(body), {
      contentType: input.mime_type,
    });

    const saved = await this.files.create({
      coopname: input.coopname,
      proposal_hash: input.proposal_hash.toLowerCase(),
      item_hash: input.item_hash ? input.item_hash.toLowerCase() : null,
      kind: input.kind,
      checksum_sha256: actualChecksum,
      mime_type: input.mime_type,
      size_bytes: body.byteLength,
      storage_key: storageKey,
      original_filename: input.original_filename ?? null,
      uploaded_by_username: uploadedByUsername,
      uploaded_at: new Date(),
    });

    await this.syncPaymentProofMark(saved);

    const readUrl = await this.bucket.getReadUrl(storageKey);
    return { data: saved, readUrl };
  }

  /**
   * Зеркалит число приложенных платёжек в исходящий платёж реестра
   * (`blockchain_data.proof_count`) — реестр платежей показывает по нему отметку
   * «платёжка приложена», не дёргая хранилище файлов на каждую строку.
   * Статус платежа не трогаем — им управляет gateway.
   */
  private async syncPaymentProofMark(file: Pick<IExpenseFileDatabaseData, 'coopname' | 'proposal_hash' | 'item_hash' | 'kind'>): Promise<void> {
    if (file.kind !== ExpenseFileKind.PAYMENT_PROOF || !file.item_hash) return;
    const payment = await this.payments.findByHash(file.item_hash);
    if (!payment?.id) return;
    const proofs = (await this.files.findByItem(file.coopname, file.proposal_hash, file.item_hash)).filter(
      (f) => f.kind === ExpenseFileKind.PAYMENT_PROOF
    );
    await this.payments.update(payment.id, {
      blockchain_data: { ...(payment.blockchain_data ?? {}), proof_count: proofs.length },
    });
  }

  async getReadUrl(fileId: number): Promise<{ data: IExpenseFileDatabaseData; readUrl: string }> {
    const file = await this.files.findById(fileId);
    if (!file) throw new NotFoundException(`Файл расхода #${fileId} не найден.`);
    const readUrl = await this.bucket.getReadUrl(file.storage_key);
    return { data: file, readUrl };
  }

  async listByProposal(coopname: string, proposalHash: string): Promise<IExpenseFileDatabaseData[]> {
    return this.files.findByProposal(coopname, proposalHash.toLowerCase());
  }

  async listByItem(
    coopname: string,
    proposalHash: string,
    itemHash: string
  ): Promise<IExpenseFileDatabaseData[]> {
    return this.files.findByItem(coopname, proposalHash.toLowerCase(), itemHash.toLowerCase());
  }

  async deleteFile(fileId: number): Promise<void> {
    const file = await this.files.findById(fileId);
    if (!file) throw new NotFoundException(`Файл расхода #${fileId} не найден.`);
    await this.bucket.delete(file.storage_key);
    await this.files.delete(fileId);
    await this.syncPaymentProofMark(file);
  }

  private buildKey(params: {
    coopname: string;
    proposalHash: string;
    itemHash: string | null;
    kind: ExpenseFileKind;
    checksum: string;
    mimeType: string;
  }): string {
    const ext = EXTENSION_BY_MIME[params.mimeType] ?? 'bin';
    const item = params.itemHash ? params.itemHash.toLowerCase() : '_proposal';
    return `${params.coopname}/${params.proposalHash.toLowerCase()}/${item}/${params.kind}/${params.checksum}.${ext}`;
  }
}
