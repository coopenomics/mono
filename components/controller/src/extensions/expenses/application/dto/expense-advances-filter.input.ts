import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';
import { ExpenseAdvanceState } from '../../domain/enums/expense-advance-state.enum';

/** Отбор выданных авансов кооператива. */
@InputType('ExpenseAdvancesFilterInput')
export class ExpenseAdvancesFilterInputDTO {
  @Field(() => ExpenseAdvanceState, { nullable: true, description: 'Состояние аванса; пусто — все выданные.' })
  @IsOptional()
  @IsEnum(ExpenseAdvanceState)
  state?: ExpenseAdvanceState;
}
