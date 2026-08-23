import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PaymentFileKind } from '~/domain/gateway/enums/payment-file-kind.enum';
import type { IPaymentFileDatabaseData } from '~/domain/gateway/interfaces/payment-file-database.interface';

/**
 * Output DTO записи о файле платежа (чеке об оплате) в MinIO-бакете.
 *
 * `read_url` — короткоживущий HMAC-signed URL (TTL = `defaultUrlTtlSeconds` бакета),
 * выдаётся после проверки прав; держатель URL может скачать файл до истечения TTL.
 */
@ObjectType('PaymentFile', { description: 'Запись о файле, приложенном к платежу (чек об оплате).' })
export class PaymentFileOutputDTO {
  @Field(() => Int, { description: 'Внутренний ID записи.' })
  id!: number;

  @Field(() => String, { description: 'Имя кооператива (scope).' })
  coopname!: string;

  @Field(() => String, { description: 'Хеш платежа.' })
  payment_hash!: string;

  @Field(() => PaymentFileKind, { description: 'Назначение файла.' })
  kind!: PaymentFileKind;

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

  static fromDomain(data: IPaymentFileDatabaseData, readUrl?: string): PaymentFileOutputDTO {
    const dto = new PaymentFileOutputDTO();
    dto.id = data.id ?? 0;
    dto.coopname = data.coopname;
    dto.payment_hash = data.payment_hash;
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
