import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentFileEntity } from '../entities/payment-file.entity';
import type { PaymentFileRepository } from '~/domain/gateway/repositories/payment-file.repository';
import type { IPaymentFileDatabaseData } from '~/domain/gateway/interfaces/payment-file-database.interface';

/**
 * TypeORM-репозиторий файлов платежей (чеков об оплате). БД-only сущность —
 * маппинг симметричный, без доменной логики.
 */
@Injectable()
export class TypeormPaymentFileRepository implements PaymentFileRepository {
  constructor(
    @InjectRepository(PaymentFileEntity)
    private readonly repository: Repository<PaymentFileEntity>
  ) {}

  async create(data: IPaymentFileDatabaseData): Promise<IPaymentFileDatabaseData> {
    const entity = this.repository.create({
      coopname: data.coopname,
      payment_hash: data.payment_hash,
      kind: data.kind,
      checksum_sha256: data.checksum_sha256,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      storage_key: data.storage_key,
      original_filename: data.original_filename ?? null,
      uploaded_by_username: data.uploaded_by_username,
      uploaded_at: data.uploaded_at,
    });
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: number): Promise<IPaymentFileDatabaseData | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByChecksum(coopname: string, checksum: string): Promise<IPaymentFileDatabaseData | null> {
    const entity = await this.repository.findOne({ where: { coopname, checksum_sha256: checksum } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByPayment(coopname: string, paymentHash: string): Promise<IPaymentFileDatabaseData[]> {
    const entities = await this.repository.find({
      where: { coopname, payment_hash: paymentHash.toLowerCase() },
      order: { uploaded_at: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(entity: PaymentFileEntity): IPaymentFileDatabaseData {
    return {
      id: entity.id,
      coopname: entity.coopname,
      payment_hash: entity.payment_hash,
      kind: entity.kind,
      checksum_sha256: entity.checksum_sha256,
      mime_type: entity.mime_type,
      size_bytes: entity.size_bytes,
      storage_key: entity.storage_key,
      original_filename: entity.original_filename,
      uploaded_by_username: entity.uploaded_by_username,
      uploaded_at: entity.uploaded_at,
    };
  }
}
