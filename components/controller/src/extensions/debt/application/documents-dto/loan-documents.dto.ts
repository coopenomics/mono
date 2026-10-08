import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Данные для документов займа. Основание договора, его номер и дату, сумму
 * прописью и обеспечение словами подставляет фабрика по ключу обеспечения —
 * фронт передаёт только то, что выбрал пайщик.
 */
@InputType('DebtLoanDocumentBaseInput')
class LoanDocumentBaseInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Пайщик-заёмщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хэш займа; его короткая форма — номер договора' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;

  @Field(() => String, { description: 'Сумма займа' })
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @Field(() => String, { description: 'Срок возврата' })
  @IsNotEmpty()
  @IsString()
  due_at!: string;

  @Field(() => String, { description: 'Ключ обеспечения из реестра обеспечения' })
  @IsNotEmpty()
  @IsString()
  collateral!: string;
}

@InputType('DebtGenerateLoanStatementInput')
export class GenerateLoanStatementInputDTO extends LoanDocumentBaseInputDTO {
  @Field(() => String, { description: 'Платёжный метод пайщика для получения займа' })
  @IsNotEmpty()
  @IsString()
  method_id!: string;
}

@InputType('DebtGenerateLoanContractInput')
export class GenerateLoanContractInputDTO extends LoanDocumentBaseInputDTO {}

@InputType('DebtGenerateLoanDecisionInput')
export class GenerateLoanDecisionInputDTO extends LoanDocumentBaseInputDTO {
  @Field(() => Int, { description: 'Номер решения совета' })
  @IsInt()
  decision_id!: number;
}

@InputType('DebtGenerateRepaymentStatementInput')
export class GenerateRepaymentStatementInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Пайщик-заёмщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хэш займа' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;

  @Field(() => String, { description: 'Сумма возврата' })
  @IsNotEmpty()
  @IsString()
  amount!: string;
}

@InputType('DebtGenerateExtensionStatementInput')
export class GenerateExtensionStatementInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Пайщик-заёмщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хэш займа' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;

  @Field(() => String, { description: 'Новый срок возврата' })
  @IsNotEmpty()
  @IsString()
  new_due_at!: string;

  @Field(() => String, { nullable: true, description: 'Остаток долга на дату заявления; пусто — берётся из реестра' })
  @IsOptional()
  @IsString()
  remaining?: string;
}
