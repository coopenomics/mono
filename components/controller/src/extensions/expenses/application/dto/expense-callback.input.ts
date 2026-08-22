import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

/**
 * Callback на финализацию `expense::closeexp`. Пустой `contract` (`""`) = нет callback.
 * Зеркалит `ExpenseDomain::callback_handler` из `expense.hpp`.
 */
@InputType('ExpenseCallbackInput')
export class ExpenseCallbackInputDTO {
  @Field(() => String, { nullable: true, description: 'Контракт-целевой' })
  @IsOptional()
  @IsString()
  contract?: string;

  @Field(() => String, { nullable: true, description: 'Action-метод' })
  @IsOptional()
  @IsString()
  action?: string;

  @Field(() => String, { nullable: true, description: 'Payload (hex bytes)' })
  @IsOptional()
  @IsString()
  data?: string;
}
