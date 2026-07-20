import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Input для action `expense::returnexp` — возврат неиспользованного аванса (ADVANCE).
 */
@InputType('ReturnExpenseItemInput')
export class ReturnExpenseItemInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хеш сметы расхода (proposal).' })
  @IsNotEmpty()
  @IsString()
  proposal_hash!: string;

  @Field(() => String, { description: 'Хеш строки расхода (item).' })
  @IsNotEmpty()
  @IsString()
  item_hash!: string;

  @Field(() => String, { description: 'Возвращаемая сумма (asset, например "50.0000 RUB").' })
  @IsNotEmpty()
  @Matches(/^\d+\.\d{1,8} [A-Z]{1,7}$/, { message: 'return_amount должен быть в формате asset (например "50.0000 RUB").' })
  return_amount!: string;
}
