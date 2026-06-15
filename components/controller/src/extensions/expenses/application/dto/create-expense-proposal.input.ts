import { Field, InputType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseItemInputDTO } from './expense-item.input';
import { ExpenseCallbackInputDTO } from './expense-callback.input';
import { ExpenseProposalStatementSignedDocumentInputDTO } from '~/application/document/documents-dto/expense-proposal-statement-document.dto';

/**
 * Input создания и подачи СЗ-расхода (создатель сметы — пайщик / председатель).
 *
 * Сабмит: `expense::createexp` через `ExpensesBlockchainPort.createExp`.
 * Подпись `statement` (registry 2010) сделана на стороне UI через `Classes.Document`.
 */
@InputType('CreateExpenseProposalInput')
export class CreateExpenseProposalInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пайщика-создателя СЗ.' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хеш сметы расхода (детерминированный, из UI).' })
  @IsNotEmpty()
  @IsString()
  proposal_hash!: string;

  @Field(() => String, {
    description: 'Источник средств (eosio::name кошелька-источника, eg "w.cap.blago").',
  })
  @IsNotEmpty()
  @IsString()
  source_wallet!: string;

  @Field(() => [ExpenseItemInputDTO], { description: 'Строки расхода (массив items).' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemInputDTO)
  items!: ExpenseItemInputDTO[];

  @Field(() => ExpenseCallbackInputDTO, {
    nullable: true,
    description: 'Callback на финализацию closeexp (опционально).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpenseCallbackInputDTO)
  callback?: ExpenseCallbackInputDTO;

  @Field(() => ExpenseProposalStatementSignedDocumentInputDTO, {
    description: 'Подписанная СЗ-смета (document2, registry 2010).',
  })
  @ValidateNested()
  @Type(() => ExpenseProposalStatementSignedDocumentInputDTO)
  statement!: ExpenseProposalStatementSignedDocumentInputDTO;
}
