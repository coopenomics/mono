import { Field, Int, InputType } from '@nestjs/graphql';
import { IsBase64, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { SUPPORT_BUCKET } from '../../constants/support-bucket';

/**
 * Вложение внутри `createSupportTicket` / `replySupportTicket`.
 *
 * Форма — та же, что у `UploadExpenseFileInputDTO` в расходах: содержимое
 * base64 плюс заявленные клиентом размер, тип и контрольная сумма. Клиент,
 * который умеет отправить файл в смету, умеет отправить его и в обращение.
 *
 * Отличия от образца намеренные:
 * - полей `coopname`/`proposal_hash`/`item_hash`/`kind` здесь нет — вложение
 *   не адресуется само по себе, оно всегда часть создаваемого сообщения, и
 *   куда его класть, решает вызвавшая мутация;
 * - у `size_bytes` и у `mime_type` предел и список берутся ссылкой на
 *   `SUPPORT_BUCKET` — то же объявление, что читает адаптер хранилища, а не
 *   второе число или список рядом с ним;
 * - список MIME в `@IsIn` — свой, из объявления бакета стола
 *   (`SUPPORT_BUCKET.allowedMime`), а не унаследованный список расходов.
 *
 * `@Max(SUPPORT_BUCKET.maxBytes)` и сверка в `verifyDeclared()` —
 * не дублирование, а две разные проверки одного предела: `@Max` отбраковывает
 * заявленный размер до разбора base64 (дёшево, до того как тело вообще
 * декодировано), `verifyDeclared()` в `SupportAttachmentsService` сверяет
 * фактический размер декодированного содержимого после. Вторая не заменяет
 * первую: без `@Max` заведомо слишком большое число доходит до декодирования
 * base64 и создания буфера, прежде чем будет отброшено.
 */
@InputType('SupportAttachmentInput')
export class SupportAttachmentInputDTO {
  @Field(() => String, { description: 'Содержимое файла, base64 без префикса data:.' })
  @IsBase64()
  content_base64!: string;

  @Field(() => Int, { description: 'Размер файла в байтах — сервер сверяет его с фактическим.' })
  @IsInt()
  @Min(1)
  @Max(SUPPORT_BUCKET.maxBytes)
  size_bytes!: number;

  @Field(() => String, {
    description: 'Заявленный MIME-тип содержимого — сервер сверяет его с определённым по содержимому файла.',
  })
  @IsIn([...SUPPORT_BUCKET.allowedMime], { message: 'mime_type должен быть одним из допустимых для вложений обращения.' })
  mime_type!: string;

  @Field(() => String, { description: 'SHA-256 содержимого, hex-lowercase (64 hex-символа).' })
  @Matches(/^[a-f0-9]{64}$/, { message: 'checksum_sha256 должен быть 64-символьным lowercase hex.' })
  checksum_sha256!: string;

  @Field(() => String, { nullable: true, description: 'Оригинальное имя файла — только для отображения.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  original_filename?: string;
}
