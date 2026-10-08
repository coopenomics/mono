import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Данные документов займа под коммиты (Генерация). Основание (договор об
 * участии с номером и датой), номер приложения об ответственном хранении и
 * сумму прописью подставляет сервер — стол передаёт только выбор пайщика.
 */
@InputType('CapitalLoanDocumentBaseInput')
class CapitalLoanDocumentBaseInputDTO {
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
}

@InputType('CapitalLoanStatementGenerateInput')
export class CapitalLoanStatementGenerateInputDTO extends CapitalLoanDocumentBaseInputDTO {
  @Field(() => String, { description: 'Платёжный метод пайщика для получения займа' })
  @IsNotEmpty()
  @IsString()
  method_id!: string;
}

@InputType('CapitalLoanContractGenerateInput')
export class CapitalLoanContractGenerateInputDTO extends CapitalLoanDocumentBaseInputDTO {}

@InputType('CapitalLoanDecisionGenerateInput')
export class CapitalLoanDecisionGenerateInputDTO extends CapitalLoanDocumentBaseInputDTO {
  @Field(() => Int, { description: 'Номер решения совета' })
  @IsInt()
  decision_id!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Номер приложения об ответственном хранении из заявления; пусто — берётся из сведений пайщика',
  })
  @IsOptional()
  @IsString()
  storage_appendix_number?: string;
}

@InputType('CapitalDebtRefInput')
export class CapitalDebtRefInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хэш займа' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;
}
