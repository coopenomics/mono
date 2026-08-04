import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Пополнение пула программных расходов кооператива (председатель).
 * Перевод суммы из `global_available_invest_pool` в `program_expense_pool`.
 */
@InputType('CapitalTopupProgramExpenseInput')
export class TopupProgramExpenseInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Сумма пополнения (asset, eg "10000.0000 RUB").' })
  @IsNotEmpty()
  @IsString()
  amount!: string;
}
