import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { validationMessage } from '@coopenomics/extension-kit';

/** Фотография пайщика для удостоверения: содержимое файла и его тип. */
@InputType('UploadAvatarInput')
export class UploadAvatarInputDTO {
  @Field(() => String, { description: 'Содержимое файла в base64' })
  @IsString()
  @IsNotEmpty({ message: validationMessage('account.uploadAvatarInput.contentRequired') })
  public readonly content_base64!: string;

  @Field(() => String, { description: 'Тип файла: image/jpeg, image/png или image/webp' })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'], { message: validationMessage('account.uploadAvatarInput.mimeTypeInvalid') })
  public readonly mime_type!: string;
}
