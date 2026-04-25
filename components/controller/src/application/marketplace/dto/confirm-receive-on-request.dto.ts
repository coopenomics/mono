import { Field, InputType } from '@nestjs/graphql';
import { IsString, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnByAssetActSignedDocumentInputDTO } from '../../document/documents-dto/return-by-asset-act-document.dto';

@InputType('ConfirmReceiveOnRequestInput', {
  description: 'Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи',
})
export class ConfirmReceiveOnRequestInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Идентификатор обмена' })
  @IsNumber()
  exchange_id!: number;

  @Field(() => ReturnByAssetActSignedDocumentInputDTO, {
    description:
      'Подписанный акт приёмки-передачи имущества Уполномоченным лицом из Кооператива при возврате Заказчику по новации',
  })
  @ValidateNested()
  @Type(() => ReturnByAssetActSignedDocumentInputDTO)
  document!: ReturnByAssetActSignedDocumentInputDTO;
}
