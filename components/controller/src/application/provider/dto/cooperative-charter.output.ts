import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { ICooperativeCharterDatabaseData } from '~/domain/cooperative-charter/interfaces/cooperative-charter-database.interface';

/**
 * Устав кооператива, приложенный к заявке на подключение.
 *
 * `read_url` — короткоживущий HMAC-signed URL (TTL бакета `registrator:charters`),
 * выдаётся после проверки прав; держатель ссылки скачает файл до истечения TTL.
 */
@ObjectType('CooperativeCharter', { description: 'Устав кооператива, приложенный к заявке на подключение.' })
export class CooperativeCharterOutputDTO {
  @Field(() => Int, { description: 'Внутренний ID записи.' })
  id!: number;

  @Field(() => String, { description: 'Контур союза, в котором хранится устав.' })
  coopname!: string;

  @Field(() => String, { description: 'Аккаунт кооператива, чей это устав.' })
  username!: string;

  @Field(() => String, { description: 'SHA-256 содержимого, hex-lowercase.' })
  checksum_sha256!: string;

  @Field(() => String, { description: 'MIME-тип содержимого.' })
  mime_type!: string;

  @Field(() => Int, { description: 'Размер файла в байтах.' })
  size_bytes!: number;

  @Field(() => String, { nullable: true, description: 'Оригинальное имя загруженного файла.' })
  original_filename?: string;

  @Field(() => String, { description: 'Кто загрузил (username).' })
  uploaded_by_username!: string;

  @Field(() => Date, { description: 'Когда загружено.' })
  uploaded_at!: Date;

  @Field(() => String, { nullable: true, description: 'Короткоживущий URL на скачивание (HMAC-signed).' })
  read_url?: string;

  static fromDomain(data: ICooperativeCharterDatabaseData, readUrl?: string): CooperativeCharterOutputDTO {
    const dto = new CooperativeCharterOutputDTO();
    dto.id = data.id as number;
    dto.coopname = data.coopname;
    dto.username = data.username;
    dto.checksum_sha256 = data.checksum_sha256;
    dto.mime_type = data.mime_type;
    dto.size_bytes = data.size_bytes;
    dto.original_filename = data.original_filename ?? undefined;
    dto.uploaded_by_username = data.uploaded_by_username;
    dto.uploaded_at = data.uploaded_at;
    dto.read_url = readUrl;
    return dto;
  }
}
