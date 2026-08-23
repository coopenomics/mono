import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Input для финализации СЗ-отчёта по смете расхода.
 *
 * Пайщик/председатель закрывают смету, когда все items уже reported/returned.
 * На-цепи это эквивалент `expense::closeexp` (см. `contracts/cpp/expense/expense.hpp`).
 * Поле `total_actual_amount` опционально — backend в Phase 2 сверит его с суммой
 * фактических item-сумм перед submit'ом (защита от UI-расхождения).
 */
@InputType('SubmitExpenseReportInput')
export class SubmitExpenseReportInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хеш сметы расхода.' })
  @IsNotEmpty()
  @IsString()
  proposal_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Итоговая сумма фактических расходов (asset, например "1500.0000 RUB").',
  })
  @IsOptional()
  @Matches(/^\d+\.\d{1,8} [A-Z]{1,7}$/)
  total_actual_amount?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Комментарий пайщика к финализации отчёта (свободный текст, до 1000 символов).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
