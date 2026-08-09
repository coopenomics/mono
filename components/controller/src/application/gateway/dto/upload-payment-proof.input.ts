import { Field, InputType } from '@nestjs/graphql';
import { IsBase64, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;

/**
 * Input для `uploadPaymentProof` — приложить чек об оплате к платежу.
 *
 * Привязка по `payment_hash`. MVP-передача: base64-содержимое внутри mutation
 * (до 20 МБ — хватает для фото/PDF чека). Вид файла всегда PAYMENT_PROOF
 * (чек об оплате) — поэтому в input не выносится.
 */
@InputType('UploadPaymentProofInput')
export class UploadPaymentProofInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хеш платежа, к которому прикладывается чек.' })
  @IsNotEmpty()
  @IsString()
  payment_hash!: string;

  @Field(() => String, { description: 'MIME-тип содержимого.' })
  @IsIn([...ALLOWED_MIME], { message: 'mime_type должен быть одним из allowed.' })
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
  @Matches(/^[a-f0-9]{64}$/, { message: 'checksum_sha256 должен быть 64-символьным lowercase hex.' })
  checksum_sha256!: string;

  @Field(() => String, { description: 'Содержимое файла, base64 без префикса data:.' })
  @IsBase64()
  content_base64!: string;
}
