import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsBase64, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ExpenseFileKind } from '../../domain/enums/expense-file-kind.enum';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;

/**
 * Input для `uploadExpenseFile` — загрузка платёжки / чека / доказательства возврата.
 *
 * MVP-передача: base64-содержимое внутри GraphQL-mutation. Размер ограничен `maxBytes` бакета
 * (20 MB) — для типичных фото/PDF этого хватает. В Phase 2 при необходимости заменим на
 * pre-signed upload URL (для крупных файлов / лучшего UX).
 */
@InputType('UploadExpenseFileInput')
export class UploadExpenseFileInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хеш сметы расхода.' })
  @IsNotEmpty()
  @IsString()
  proposal_hash!: string;

  @Field(() => String, { nullable: true, description: 'Хеш строки расхода (пусто — файл уровня сметы).' })
  @IsOptional()
  @IsString()
  item_hash?: string;

  @Field(() => ExpenseFileKind, { description: 'Назначение файла (платёжка/чек/возврат).' })
  kind!: ExpenseFileKind;

  @Field(() => String, { description: 'MIME-тип содержимого.' })
  @IsIn([...ALLOWED_MIME], { message: validationMessage('expenses.uploadExpenseFile.mimeTypeHint') })
  mime_type!: string;

  @Field(() => String, { nullable: true, description: 'Оригинальное имя файла — для отображения и поиска.' })
  @IsOptional()
  @IsString()
  original_filename?: string;

  @Field(() => Number, { description: 'Размер файла в байтах (для серверной валидации).' })
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size_bytes!: number;

  @Field(() => String, { description: 'SHA-256 содержимого, hex-lowercase (64 hex-символа).' })
  @Matches(/^[a-f0-9]{64}$/, { message: validationMessage('expenses.uploadExpenseFile.checksumFormatHint') })
  checksum_sha256!: string;

  @Field(() => String, { description: 'Содержимое файла, base64 без префикса data:.' })
  @IsBase64()
  content_base64!: string;
}
