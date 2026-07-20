import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ExpenseFileKind } from '../../domain/enums/expense-file-kind.enum';
import type { IExpenseFileDatabaseData } from '../../domain/interfaces/expense-file-database.interface';

/**
 * Output DTO записи о первичном файле расхода в MinIO-бакете.
 *
 * `read_url` — короткоживущий HMAC-signed URL (TTL = `defaultUrlTtlSeconds` бакета).
 * Доменный код выдаёт URL уже после проверки ACL; держатель URL может скачать до истечения TTL.
 */
@ObjectType('ExpenseFile', { description: 'Запись о первичном файле расхода (платёжка/чек/возврат).' })
export class ExpenseFileOutputDTO {
  @Field(() => Int, { description: 'Внутренний ID записи.' })
  id!: number;

  @Field(() => String, { description: 'Имя кооператива (scope).' })
  coopname!: string;

  @Field(() => String, { description: 'Хеш сметы расхода.' })
  proposal_hash!: string;

  @Field(() => String, { nullable: true, description: 'Хеш строки расхода (если файл уровня item).' })
  item_hash?: string;

  @Field(() => ExpenseFileKind, { description: 'Назначение файла.' })
  kind!: ExpenseFileKind;

  @Field(() => String, { description: 'SHA-256 содержимого, hex-lowercase.' })
  checksum_sha256!: string;

  @Field(() => String, { description: 'MIME-тип содержимого.' })
  mime_type!: string;

  @Field(() => Int, { description: 'Размер файла в байтах.' })
  size_bytes!: number;

  @Field(() => String, { description: 'MinIO-ключ внутри бакета.' })
  storage_key!: string;

  @Field(() => String, { nullable: true, description: 'Оригинальное имя загруженного файла.' })
  original_filename?: string;

  @Field(() => String, { description: 'Кто загрузил (username).' })
  uploaded_by_username!: string;

  @Field(() => Date, { description: 'Когда загружено.' })
  uploaded_at!: Date;

  @Field(() => String, { nullable: true, description: 'Короткоживущий URL на скачивание (HMAC-signed).' })
  read_url?: string;

  static fromDomain(data: IExpenseFileDatabaseData, readUrl?: string): ExpenseFileOutputDTO {
    const dto = new ExpenseFileOutputDTO();
    dto.id = data.id ?? 0;
    dto.coopname = data.coopname;
    dto.proposal_hash = data.proposal_hash;
    dto.item_hash = data.item_hash ?? undefined;
    dto.kind = data.kind;
    dto.checksum_sha256 = data.checksum_sha256;
    dto.mime_type = data.mime_type;
    dto.size_bytes = data.size_bytes;
    dto.storage_key = data.storage_key;
    dto.original_filename = data.original_filename ?? undefined;
    dto.uploaded_by_username = data.uploaded_by_username;
    dto.uploaded_at = data.uploaded_at;
    dto.read_url = readUrl;
    return dto;
  }
}
