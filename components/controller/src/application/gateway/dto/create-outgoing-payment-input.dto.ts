import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateOutgoingPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-outgoing-payment-input-domain.interface';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

/**
 * DTO для создания исходящего платежа
 */
@InputType('CreateOutgoingPaymentInput')
export class CreateOutgoingPaymentInputDTO implements CreateOutgoingPaymentInputDomainInterface {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  quantity!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  method_id!: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  memo?: string;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный документ заявления на возврат денежными средствами',
  })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
