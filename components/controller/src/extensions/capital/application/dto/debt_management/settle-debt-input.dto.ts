import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

/**
 * Возврат займа деньгами. Сумма должна покрывать заём целиком —
 * частичный возврат не предусмотрен.
 */
@InputType('SettleDebtInput')
export class SettleDebtInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор займа' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;

  @Field(() => String, { description: 'Сумма возврата, например «30000.0000 RUB»' })
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление пайщика о возврате займа' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}

/**
 * Повторная отправка платежа по займу после отказа по реквизитам.
 */
@InputType('RetryDebtPaymentInput')
export class RetryDebtPaymentInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор займа' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;
}

/**
 * Закрытие невозвращённого займа: работа-обеспечение переходит кооперативу.
 */
@InputType('CloseDebtInput')
export class CloseDebtInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор займа' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;
}

/**
 * Перевод в просрочку займов, срок возврата которых прошёл.
 */
@InputType('MarkOverdueDebtsInput')
export class MarkOverdueDebtsInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;
}
