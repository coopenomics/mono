import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumberString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetContributionActSignedDocumentInputDTO } from '../../document/documents-dto/asset-contribution-act-document.dto';

@InputType('ConfirmSupplyOnRequestInput', {
  description: 'Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи',
})
export class ConfirmSupplyOnRequestInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Идентификатор обмена' })
  @IsNumberString()
  exchange_id!: string;

  @Field(() => AssetContributionActSignedDocumentInputDTO, {
    description: 'Подписанный акт приёма-передачи имущества от Поставщика в Кооператив',
  })
  @ValidateNested()
  @Type(() => AssetContributionActSignedDocumentInputDTO)
  document!: AssetContributionActSignedDocumentInputDTO;
}
