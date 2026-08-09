import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * GraphQL Input DTO для мутации подтверждения одобрения
 */
@InputType('ConfirmApproveInput', {
  description: 'Входные данные для подтверждения одобрения документа',
})
export class ConfirmApproveInputDTO {
  @Field(() => String, {
    description: 'Название кооператива',
  })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, {
    description: 'Хеш одобрения для идентификации',
  })
  @IsString()
  @IsNotEmpty()
  approval_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Одобренный документ в формате JSON',
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  approved_document?: ISignedDocumentDomainInterface;
}
