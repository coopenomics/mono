import { Field, InputType } from '@nestjs/graphql';
import { IsBase64, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { CHARTER_BUCKET } from '~/domain/cooperative-charter/constants/charter-bucket';

/**
 * Input для `uploadCooperativeCharter` — приложить устав к заявке кооператива
 * на подключение к платформе.
 *
 * Передача как у прочих загрузок контура: base64 внутри мутации плюс SHA-256,
 * по которому сервер убеждается, что содержимое доехало целым.
 */
@InputType('UploadCooperativeCharterInput')
export class UploadCooperativeCharterInputDTO {
  @Field(() => String, { description: 'Контур союза, куда подаётся заявка (coopname оператора).' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Аккаунт кооператива, чей это устав.' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'MIME-тип содержимого (PDF или скан-изображение).' })
  @IsIn([...CHARTER_BUCKET.allowedMime], { message: 'Устав принимается в PDF, JPEG или PNG.' })
  mime_type!: string;

  @Field(() => String, { nullable: true, description: 'Оригинальное имя файла — для отображения совету.' })
  @IsOptional()
  @IsString()
  original_filename?: string;

  @Field(() => Number, { description: 'Размер файла в байтах (для серверной валидации).' })
  @IsInt()
  @Min(1)
  @Max(CHARTER_BUCKET.maxBytes)
  size_bytes!: number;

  @Field(() => String, { description: 'SHA-256 содержимого, hex-lowercase (64 hex-символа).' })
  @Matches(/^[a-f0-9]{64}$/, { message: 'checksum_sha256 должен быть 64-символьным lowercase hex.' })
  checksum_sha256!: string;

  @Field(() => String, { description: 'Содержимое файла, base64 без префикса data:.' })
  @IsBase64()
  content_base64!: string;
}
