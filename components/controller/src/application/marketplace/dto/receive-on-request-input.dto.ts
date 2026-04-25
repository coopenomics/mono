import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnByAssetActSignedDocumentInputDTO } from '../../document/documents-dto/return-by-asset-act-document.dto';

/**
 * DTO для получения по запросу.
 */
@InputType('ReceiveOnRequestInput')
export class ReceiveOnRequestInputDTO {
  @Field({ description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field({ description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => Number, { description: 'Идентификатор заявки' })
  @IsNumber()
  exchange_id!: number;

  @Field(() => ReturnByAssetActSignedDocumentInputDTO, {
    description: 'Подписанный Заказчиком акт приёмки-передачи имущества из Кооператива по новации',
  })
  @ValidateNested()
  @Type(() => ReturnByAssetActSignedDocumentInputDTO)
  document!: ReturnByAssetActSignedDocumentInputDTO;
}
