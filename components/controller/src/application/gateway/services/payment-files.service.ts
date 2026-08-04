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
import {
  PAYMENT_FILE_REPOSITORY,
  type PaymentFileRepository,
} from '~/domain/gateway/repositories/payment-file.repository';
import type { IPaymentFileDatabaseData } from '~/domain/gateway/interfaces/payment-file-database.interface';
import { PaymentFileKind } from '~/domain/gateway/enums/payment-file-kind.enum';
import { GATEWAY_BUCKET } from '~/domain/gateway/constants/gateway-bucket';
import { UploadPaymentProofInputDTO } from '../dto/upload-payment-proof.input';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/**
 * Ядровый сервис файлов платежей: чек об оплате исходящего платежа.
 *
 * «Культура денег»: входящие подтверждаем, исходящие сопровождаем чеком.
 * Привязка по `payment_hash` — единый ключ любого платежа, поэтому механизм
 * один на все исходящие (возврат паевого/withdrawal/registration-refund/аванс
 * расхода) и переиспользуется расширениями. Контроль мягкий: статус платежа не
 * трогаем (деньги уже ушли on-chain), но зеркалим число чеков в
 * `blockchain_data.proof_count` — реестр по нему рисует «чек приложен / нет».
 *
 * Ключ MinIO детерминирован: `{coopname}/gateway/{payment_hash}/{kind}/{checksum}.{ext}`.
 * Повторная загрузка того же содержимого идемпотентна на бакете, в БД защищаемся
 * явным `findByChecksum` (409 при дубле).
 */
@UseBucket(GATEWAY_BUCKET)
@Injectable()
export class PaymentFilesService {
  constructor(
    @InjectBucket() private readonly bucket: InterFileStorageBucket,
    @Inject(PAYMENT_FILE_REPOSITORY) private readonly files: PaymentFileRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository
  ) {}

  async uploadProof(
    input: UploadPaymentProofInputDTO,
    uploadedByUsername: string
  ): Promise<{ data: IPaymentFileDatabaseData; readUrl: string }> {
    const body = Buffer.from(input.content_base64, 'base64');
    if (body.byteLength !== input.size_bytes) {
      throw new BadRequestException(
        `size_bytes (${input.size_bytes}) не совпадает с фактическим размером base64-контента (${body.byteLength}).`
      );
    }
    const actualChecksum = createHash('sha256').update(body).digest('hex');
    if (actualChecksum !== input.checksum_sha256.toLowerCase()) {
      throw new BadRequestException(`checksum_sha256 не совпадает с реальным SHA-256 содержимого.`);
    }

    const payment = await this.payments.findByHash(input.payment_hash);
    if (!payment) {
      throw new NotFoundException(`Платёж ${input.payment_hash} не найден.`);
    }

    const existing = await this.files.findByChecksum(input.coopname, actualChecksum);
    if (existing) {
      throw new ConflictException(
        `Файл с таким SHA-256 уже зарегистрирован в этом кооперативе (id=${existing.id}).`
      );
    }

    const storageKey = this.buildKey({
      coopname: input.coopname,
      paymentHash: input.payment_hash,
      kind: PaymentFileKind.PAYMENT_PROOF,
      checksum: actualChecksum,
      mimeType: input.mime_type,
    });

    await this.bucket.put(storageKey, new Uint8Array(body), { contentType: input.mime_type });

    const saved = await this.files.create({
      coopname: input.coopname,
      payment_hash: input.payment_hash.toLowerCase(),
      kind: PaymentFileKind.PAYMENT_PROOF,
      checksum_sha256: actualChecksum,
      mime_type: input.mime_type,
      size_bytes: body.byteLength,
      storage_key: storageKey,
      original_filename: input.original_filename ?? null,
      uploaded_by_username: uploadedByUsername,
      uploaded_at: new Date(),
    });

    await this.syncProofMark(saved.coopname, saved.payment_hash);

    const readUrl = await this.bucket.getReadUrl(storageKey);
    return { data: saved, readUrl };
  }

  async getReadUrl(fileId: number): Promise<{ data: IPaymentFileDatabaseData; readUrl: string }> {
    const file = await this.files.findById(fileId);
    if (!file) throw new NotFoundException(`Файл платежа #${fileId} не найден.`);
    const readUrl = await this.bucket.getReadUrl(file.storage_key);
    return { data: file, readUrl };
  }

  async listByPayment(coopname: string, paymentHash: string): Promise<IPaymentFileDatabaseData[]> {
    return this.files.findByPayment(coopname, paymentHash.toLowerCase());
  }

  async deleteFile(fileId: number): Promise<void> {
    const file = await this.files.findById(fileId);
    if (!file) throw new NotFoundException(`Файл платежа #${fileId} не найден.`);
    await this.bucket.delete(file.storage_key);
    await this.files.delete(fileId);
    await this.syncProofMark(file.coopname, file.payment_hash);
  }

  /**
   * Зеркалит число приложенных чеков в платёж (`blockchain_data.proof_count`) —
   * реестр показывает по нему «чек приложен / не приложен», не дёргая хранилище
   * файлов на каждую строку. Статус платежа не трогаем (им управляет gateway).
   */
  private async syncProofMark(coopname: string, paymentHash: string): Promise<void> {
    const payment = await this.payments.findByHash(paymentHash);
    if (!payment?.id) return;
    const proofs = await this.files.findByPayment(coopname, paymentHash);
    await this.payments.update(payment.id, {
      blockchain_data: { ...(payment.blockchain_data ?? {}), proof_count: proofs.length },
    });
  }

  private buildKey(params: {
    coopname: string;
    paymentHash: string;
    kind: PaymentFileKind;
    checksum: string;
    mimeType: string;
  }): string {
    const ext = EXTENSION_BY_MIME[params.mimeType] ?? 'bin';
    return `${params.coopname}/gateway/${params.paymentHash.toLowerCase()}/${params.kind}/${params.checksum}.${ext}`;
  }
}
