import { InputType, Field } from '@nestjs/graphql';
import { AssetContributionStatementSignedDocumentInputDTO } from '../../document/documents-dto/asset-contribution-statement-document.dto';
import { IsNumber, IsString } from 'class-validator';

@InputType('AcceptChildOrderInput')
export class AcceptChildOrderInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Идентификатор заявки' })
  @IsNumber()
  exchange_id!: number;

  @Field(() => AssetContributionStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление на имущественный паевый взнос',
  })
  document!: AssetContributionStatementSignedDocumentInputDTO;
}
