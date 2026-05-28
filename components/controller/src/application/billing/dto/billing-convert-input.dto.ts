import { Field, InputType } from '@nestjs/graphql';
import { IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BillingConversionStatementSignedDocumentInputDTO } from '~/application/document/documents-dto/billing-conversion-statement-document.dto';

/**
 * Input мутации `billingConvert` (действие `billing::convert`, operation `o.bil.fund`).
 *
 * Конвертирует паевой взнос пайщика в членский на персональный биллинг-кошелёк
 * (`w.wal.bill`). `amount` — строка с символом, как в apply: `"1500.0000 RUB"`.
 * `document` — подписанное пайщиком заявление (document2): согласие на конвертацию.
 */
@InputType('BillingConvertInput')
export class BillingConvertInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пайщика — владельца биллинг-кошелька' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Сумма с символом, например "1500.0000 RUB"' })
  @IsString()
  @Matches(/^\d+(\.\d+)?\s+[A-Z]{1,7}$/, { message: 'Формат "<amount> <SYMBOL>", например "1500.0000 RUB"' })
  amount!: string;

  @Field(() => BillingConversionStatementSignedDocumentInputDTO, {
    description:
      'Подписанное пайщиком заявление 1095.BillingConversionStatement ' +
      '(document2 с типизированной meta: convert_amount).',
  })
  @ValidateNested()
  @Type(() => BillingConversionStatementSignedDocumentInputDTO)
  document!: BillingConversionStatementSignedDocumentInputDTO;
}
