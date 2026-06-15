import { ExpenseFileTypeormEntity } from '../entities/expense-file.typeorm-entity';
import type { IExpenseFileDatabaseData } from '../../domain/interfaces/expense-file-database.interface';

/**
 * Маппер для записей файлов расхода. БД-only сущность — symmetric copy без
 * дополнительной логики.
 */
export class ExpenseFileMapper {
  static toDomain(entity: ExpenseFileTypeormEntity): IExpenseFileDatabaseData {
    return {
      id: entity.id,
      coopname: entity.coopname,
      proposal_hash: entity.proposal_hash,
      item_hash: entity.item_hash,
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

  static toEntity(data: IExpenseFileDatabaseData): Partial<ExpenseFileTypeormEntity> {
    return {
      coopname: data.coopname,
      proposal_hash: data.proposal_hash,
      item_hash: data.item_hash ?? null,
      kind: data.kind,
      checksum_sha256: data.checksum_sha256,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      storage_key: data.storage_key,
      original_filename: data.original_filename ?? null,
      uploaded_by_username: data.uploaded_by_username,
      uploaded_at: data.uploaded_at,
    };
  }
}
