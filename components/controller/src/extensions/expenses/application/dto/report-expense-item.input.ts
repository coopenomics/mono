import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Input для отчёта пайщика по строке-авансу (ADVANCE).
 *
 * `actual_amount` — фактически потраченная сумма по чекам:
 *   - не указана либо равна выданному авансу → позиция закрывается сразу
 *     (`expense::reportexp`);
 *   - меньше аванса (недорасход) → заводится входящая платёжка возврата разницы
 *     (пайщик возвращает на расчётный счёт), `reportexp` отложен до её приёма;
 *   - больше аванса (перерасход) → заводится исходящая платёжка-доплата разницы,
 *     `reportexp` отложен до её выплаты.
 */
@InputType('ReportExpenseItemInput')
export class ReportExpenseItemInputDTO {
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

  @Field(() => String, {
    nullable: true,
    description: 'Фактически потраченная сумма по чекам (asset, например "800.0000 RUB"). Не указана — равна выданному авансу.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d{1,8} [A-Z]{1,7}$/, { message: 'actual_amount должен быть в формате asset (например "800.0000 RUB").' })
  actual_amount?: string;
}
