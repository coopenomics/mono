import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ShareTransferStatementSignedDocumentInputDTO } from '../../documents-dto/share-transfer-statement-document.dto';

/** Трансляция паевого взноса из Благороста в Цифровой Кошелёк по подписанному заявлению. */
@InputType('CapitalTransferShareInput')
export class TransferShareInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Пайщик, чей паевой взнос транслируется' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String, { description: 'Сумма трансляции, с валютой — та же, что в заявлении' })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @Field(() => ShareTransferStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление о трансляции паевого взноса в Цифровой Кошелёк',
  })
  @ValidateNested()
  @Type(() => ShareTransferStatementSignedDocumentInputDTO)
  statement!: ShareTransferStatementSignedDocumentInputDTO;
}
