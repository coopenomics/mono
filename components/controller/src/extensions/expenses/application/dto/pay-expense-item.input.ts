import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Input для action `expense::payexp` — выдача аванса (ADVANCE) или прямая оплата (DIRECT).
 *
 * `actual_amount` — `asset` (`"100.0000 RUB"`), формат проверяется регуляркой.
 */
@InputType('PayExpenseItemInput')
export class PayExpenseItemInputDTO {
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

  @Field(() => String, { description: 'Фактическая сумма оплаты (asset, например "100.0000 RUB").' })
  @IsNotEmpty()
  @Matches(/^\d+\.\d{1,8} [A-Z]{1,7}$/, { message: 'actual_amount должен быть в формате asset (например "100.0000 RUB").' })
  actual_amount!: string;
}
