import { Field, InputType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseItemInputDTO } from '~/extensions/expenses/application/dto/expense-item.input';
import { ExpenseProposalStatementSignedDocumentInputDTO } from '~/application/document/documents-dto/expense-proposal-statement-document.dto';

/**
 * Создание программного расхода капитала через шасси `expense`.
 * Capital резервирует `program_expense_pool` на сумму items и шлёт inline
 * action `expense::createexp` с callback `{capital, onpgexpdone}`. Дальше
 * lifecycle обслуживает шасси; capital получает callback на финализацию.
 */
@InputType('CapitalCreateProgramExpenseInput')
export class CreateProgramExpenseInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хэш СЗ-расхода (детерминированный, из UI). Он же станет proposal_hash в шасси.' })
  @IsNotEmpty()
  @IsString()
  expense_hash!: string;

  @Field(() => String, { description: 'Имя пайщика-создателя СЗ (председатель).' })
  @IsNotEmpty()
  @IsString()
  creator!: string;

  @Field(() => [ExpenseItemInputDTO], { description: 'Строки расхода. Способ оплаты (аванс под отчёт / оплата по счёту) задаётся на каждой строке отдельно.' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemInputDTO)
  items!: ExpenseItemInputDTO[];

  @Field(() => String, { description: 'Описание программного расхода.' })
  @IsString()
  description!: string;

  @Field(() => ExpenseProposalStatementSignedDocumentInputDTO, {
    description: 'Подписанная СЗ-смета (document2, registry 2010).',
  })
  @ValidateNested()
  @Type(() => ExpenseProposalStatementSignedDocumentInputDTO)
  statement!: ExpenseProposalStatementSignedDocumentInputDTO;
}
