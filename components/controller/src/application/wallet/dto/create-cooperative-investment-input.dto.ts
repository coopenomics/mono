import { Field, InputType } from '@nestjs/graphql';
import { IsString, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { CooperativeInvestStatementSignedDocumentInputDTO } from '~/application/document/documents-dto/cooperative-invest-statement.dto';

/**
 * DTO для создания заявки кооператива на инвестирование собственных средств
 * в ЦПП кооператива-оператора платформы
 */
@InputType('CreateCooperativeInvestmentInput')
export class CreateCooperativeInvestmentInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => Number, { description: 'Сумма инвестирования' })
  @IsNumber()
  quantity!: number;

  @Field(() => String, { description: 'Символ валюты' })
  @IsString()
  symbol!: string;

  @Field(() => String, { description: 'Хеш платежа для связи с заявкой на инвестирование' })
  @IsString()
  payment_hash!: string;

  @Field(() => CooperativeInvestStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление об инвестировании средств кооператива',
  })
  @ValidateNested()
  @Type(() => CooperativeInvestStatementSignedDocumentInputDTO)
  statement!: CooperativeInvestStatementSignedDocumentInputDTO;
}
