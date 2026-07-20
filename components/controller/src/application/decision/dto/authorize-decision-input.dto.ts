import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

@InputType('AuthorizeDecisionInput')
export class AuthorizeDecisionInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта председателя совета' })
  @IsString()
  chairman!: string;

  @Field(() => Int, { description: 'Идентификатор решения' })
  @IsNumber()
  decision_id!: number;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный председателем документ утверждения решения' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
