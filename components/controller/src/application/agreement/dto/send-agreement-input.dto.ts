import { Field, InputType } from '@nestjs/graphql';
import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

@InputType('SendAgreementInput')
export class SendAgreementInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта администратора' })
  @IsString()
  administrator!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Тип соглашения' })
  @IsString()
  agreement_type!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный цифровой документ соглашения' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
